# Olist Intelligence Suite - Panduan ML Training
# ================================================
# Panduan lengkap untuk training model Machine Learning
# prediksi keterlambatan pengiriman dan review jelek.
#
# Jalankan di luar Lovable menggunakan Python 3.10+
# 
# Author: Olist Intelligence Suite
# Bahasa: Indonesia

"""
STRUKTUR PROYEK ML
==================
olist_ml/
├── requirements.txt
├── README.md
├── data/                    # Letakkan 9 CSV Olist di sini
├── models/                  # Output model tersimpan
├── notebooks/               # Jupyter notebooks (opsional)
├── src/
│   ├── __init__.py
│   ├── config.py           # Konfigurasi dan konstanta
│   ├── data_loader.py      # Load dan validasi data
│   ├── feature_engineering.py  # Bangun fitur
│   ├── model_training.py   # Training model
│   ├── evaluation.py       # Evaluasi dan interpretasi
│   └── inference.py        # Prediksi batch/single
└── main.py                 # Entry point

INSTALASI
=========
pip install pandas numpy scikit-learn joblib matplotlib seaborn shap imbalanced-learn

ANTI DATA LEAKAGE
=================
Model A (Late Delivery): HANYA fitur yang diketahui SEBELUM pengiriman
Model B (Low Review): Fitur Model A + output prediksi Model A
"""

# ============================================================
# FILE: requirements.txt
# ============================================================
REQUIREMENTS_TXT = """
pandas>=2.0.0
numpy>=1.24.0
scikit-learn>=1.3.0
joblib>=1.3.0
matplotlib>=3.7.0
seaborn>=0.12.0
imbalanced-learn>=0.11.0
shap>=0.42.0
"""

# ============================================================
# FILE: src/config.py
# ============================================================
CONFIG_PY = '''
"""Konfigurasi dan konstanta untuk ML pipeline"""

from pathlib import Path

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
MODELS_DIR = PROJECT_ROOT / "models"
MODELS_DIR.mkdir(exist_ok=True)

# File names
FILE_NAMES = {
    "customers": "olist_customers_dataset.csv",
    "orders": "olist_orders_dataset.csv",
    "order_items": "olist_order_items_dataset.csv",
    "payments": "olist_order_payments_dataset.csv",
    "reviews": "olist_order_reviews_dataset.csv",
    "products": "olist_products_dataset.csv",
    "sellers": "olist_sellers_dataset.csv",
    "geolocation": "olist_geolocation_dataset.csv",
    "translations": "product_category_name_translation.csv",
}

# Kolom yang DILARANG untuk Model A (Late Delivery)
# Karena mengandung informasi SETELAH pengiriman dimulai
FORBIDDEN_COLS_MODEL_A = [
    "order_delivered_carrier_date",
    "order_delivered_customer_date",
    "carrier_to_customer_days",
    "purchase_to_customer_days",
    "approved_to_carrier_days",  # Bisa bocor jika approved setelah carrier
    "review_score",
    "review_count",
    "review_text",
    "low_review_flag",
    "late_flag",  # Ini label, bukan fitur
    "late_days",
]

# Kolom yang DILARANG untuk Model B (Low Review)
FORBIDDEN_COLS_MODEL_B = [
    "review_score",  # Ini terkait label
    "review_text",
    "low_review_flag",  # Ini label
]

# Fitur numerik untuk Model A
NUMERIC_FEATURES_A = [
    "num_items",
    "num_sellers",
    "num_categories",
    "total_price",
    "total_freight",
    "freight_ratio",
    "weight_g_mean",
    "volume_cm3_mean",
    "distance_km_mean",
    "estimated_lead_time_days",
    "shipping_limit_offset_days_mean",
    "purchase_to_approved_days",
    "payment_value_sum",
    "payment_installments_mean",
    "purchase_dayofweek",
    "purchase_month_num",
]

# Fitur kategorikal untuk Model A
CATEGORICAL_FEATURES_A = [
    "customer_state",
    "seller_state_mode",
    "category_mode",
    "payment_type_mode",
]

# Random state untuk reproducibility
RANDOM_STATE = 42
'''

# ============================================================
# FILE: src/data_loader.py
# ============================================================
DATA_LOADER_PY = '''
"""Modul untuk load dan validasi dataset Olist"""

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Tuple
from .config import DATA_DIR, FILE_NAMES


def load_raw_data() -> Dict[str, pd.DataFrame]:
    """Load semua file CSV mentah"""
    data = {}
    for key, filename in FILE_NAMES.items():
        filepath = DATA_DIR / filename
        if not filepath.exists():
            raise FileNotFoundError(f"File tidak ditemukan: {filepath}")
        data[key] = pd.read_csv(filepath)
        print(f"✓ Loaded {key}: {len(data[key]):,} baris")
    return data


def parse_timestamps(df: pd.DataFrame, columns: list) -> pd.DataFrame:
    """Parse kolom timestamp ke datetime"""
    for col in columns:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")
    return df


def calculate_haversine(lat1, lon1, lat2, lon2):
    """Hitung jarak Haversine dalam km"""
    R = 6371  # Radius bumi dalam km
    
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
    c = 2 * np.arcsin(np.sqrt(a))
    
    return R * c


def build_geolocation_centroids(geo_df: pd.DataFrame) -> pd.DataFrame:
    """Hitung median lat/lng per zip code prefix"""
    centroids = geo_df.groupby("geolocation_zip_code_prefix").agg({
        "geolocation_lat": "median",
        "geolocation_lng": "median"
    }).reset_index()
    centroids.columns = ["zip_prefix", "lat", "lng"]
    return centroids


def build_order_mart(raw_data: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    """
    Bangun order-level data mart dengan semua fitur
    """
    print("\\n=== Membangun Order Mart ===")
    
    # Parse timestamps
    orders = parse_timestamps(raw_data["orders"].copy(), [
        "order_purchase_timestamp", "order_approved_at",
        "order_delivered_carrier_date", "order_delivered_customer_date",
        "order_estimated_delivery_date"
    ])
    
    # Normalisasi teks
    customers = raw_data["customers"].copy()
    customers["customer_city"] = customers["customer_city"].str.lower().str.strip()
    customers["customer_state"] = customers["customer_state"].str.upper().str.strip()
    
    sellers = raw_data["sellers"].copy()
    sellers["seller_city"] = sellers["seller_city"].str.lower().str.strip()
    sellers["seller_state"] = sellers["seller_state"].str.upper().str.strip()
    
    # Geolocation centroids
    geo_centroids = build_geolocation_centroids(raw_data["geolocation"])
    
    # Translations
    translations = dict(zip(
        raw_data["translations"]["product_category_name"],
        raw_data["translations"]["product_category_name_english"]
    ))
    
    # Products with English category
    products = raw_data["products"].copy()
    products["category_english"] = products["product_category_name"].map(translations)
    products["volume_cm3"] = (
        products["product_length_cm"] * 
        products["product_height_cm"] * 
        products["product_width_cm"]
    )
    
    # Order items enriched
    items = raw_data["order_items"].copy()
    items = items.merge(products[["product_id", "product_weight_g", "volume_cm3", "category_english"]], 
                       on="product_id", how="left")
    items = items.merge(sellers[["seller_id", "seller_zip_code_prefix", "seller_state"]], 
                       on="seller_id", how="left")
    
    # Aggregate per order
    print("Agregasi items per order...")
    order_items_agg = items.groupby("order_id").agg({
        "order_item_id": "count",
        "seller_id": "nunique",
        "category_english": lambda x: x.mode().iloc[0] if len(x.mode()) > 0 else None,
        "price": "sum",
        "freight_value": "sum",
        "product_weight_g": ["mean", "max"],
        "volume_cm3": ["mean", "max"],
        "seller_state": lambda x: x.mode().iloc[0] if len(x.mode()) > 0 else None,
        "seller_zip_code_prefix": "first",
        "shipping_limit_date": "first",
    }).reset_index()
    order_items_agg.columns = [
        "order_id", "num_items", "num_sellers", "category_mode",
        "total_price", "total_freight", "weight_g_mean", "weight_g_max",
        "volume_cm3_mean", "volume_cm3_max", "seller_state_mode", 
        "seller_zip_prefix", "shipping_limit_date"
    ]
    
    # Count unique categories
    cat_counts = items.groupby("order_id")["category_english"].nunique().reset_index()
    cat_counts.columns = ["order_id", "num_categories"]
    order_items_agg = order_items_agg.merge(cat_counts, on="order_id", how="left")
    
    # Payments aggregation
    print("Agregasi payments...")
    payments = raw_data["payments"].copy()
    payments_agg = payments.groupby("order_id").agg({
        "payment_value": "sum",
        "payment_sequential": "count",
        "payment_installments": "mean",
        "payment_type": lambda x: x.mode().iloc[0] if len(x.mode()) > 0 else None,
    }).reset_index()
    payments_agg.columns = ["order_id", "payment_value_sum", "payment_count", 
                           "payment_installments_mean", "payment_type_mode"]
    
    # Reviews aggregation
    print("Agregasi reviews...")
    reviews = raw_data["reviews"].copy()
    reviews_agg = reviews.groupby("order_id").agg({
        "review_score": "mean",
        "review_id": "count",
        "review_comment_message": lambda x: " | ".join(x.dropna().astype(str)),
    }).reset_index()
    reviews_agg.columns = ["order_id", "review_score", "review_count", "review_text"]
    
    # Join all
    print("Join semua tabel...")
    mart = orders.merge(customers, on="customer_id", how="left")
    mart = mart.merge(order_items_agg, on="order_id", how="left")
    mart = mart.merge(payments_agg, on="order_id", how="left")
    mart = mart.merge(reviews_agg, on="order_id", how="left")
    
    # Customer geolocation
    customer_geo = customers.merge(
        geo_centroids, 
        left_on="customer_zip_code_prefix", 
        right_on="zip_prefix", 
        how="left"
    )[["customer_id", "lat", "lng"]]
    customer_geo.columns = ["customer_id", "customer_lat", "customer_lng"]
    mart = mart.merge(customer_geo, on="customer_id", how="left")
    
    # Seller geolocation (using seller_zip_prefix from items agg)
    seller_geo = geo_centroids.copy()
    seller_geo.columns = ["seller_zip_prefix", "seller_lat", "seller_lng"]
    mart = mart.merge(seller_geo, on="seller_zip_prefix", how="left")
    
    # Calculate distance
    print("Menghitung jarak...")
    mart["distance_km_mean"] = calculate_haversine(
        mart["customer_lat"], mart["customer_lng"],
        mart["seller_lat"], mart["seller_lng"]
    )
    mart.loc[mart["distance_km_mean"] > 5000, "distance_km_mean"] = np.nan
    
    # Time intervals
    print("Menghitung interval waktu...")
    mart["purchase_to_approved_days"] = (
        mart["order_approved_at"] - mart["order_purchase_timestamp"]
    ).dt.total_seconds() / 86400
    
    mart["approved_to_carrier_days"] = (
        mart["order_delivered_carrier_date"] - mart["order_approved_at"]
    ).dt.total_seconds() / 86400
    
    mart["carrier_to_customer_days"] = (
        mart["order_delivered_customer_date"] - mart["order_delivered_carrier_date"]
    ).dt.total_seconds() / 86400
    
    mart["purchase_to_customer_days"] = (
        mart["order_delivered_customer_date"] - mart["order_purchase_timestamp"]
    ).dt.total_seconds() / 86400
    
    mart["estimated_lead_time_days"] = (
        mart["order_estimated_delivery_date"] - mart["order_purchase_timestamp"]
    ).dt.total_seconds() / 86400
    
    # Shipping limit offset
    mart["shipping_limit_date"] = pd.to_datetime(mart["shipping_limit_date"], errors="coerce")
    mart["shipping_limit_offset_days_mean"] = (
        mart["shipping_limit_date"] - mart["order_purchase_timestamp"]
    ).dt.total_seconds() / 86400
    
    # Derived features
    mart["freight_ratio"] = mart["total_freight"] / (mart["total_price"] + 1e-9)
    mart["purchase_dayofweek"] = mart["order_purchase_timestamp"].dt.dayofweek
    mart["purchase_month_num"] = mart["order_purchase_timestamp"].dt.month
    mart["purchase_year"] = mart["order_purchase_timestamp"].dt.year
    
    # Labels
    print("Menghitung label...")
    delivered_mask = mart["order_status"] == "delivered"
    has_delivery = mart["order_delivered_customer_date"].notna()
    
    mart["late_flag"] = np.where(
        delivered_mask & has_delivery,
        (mart["order_delivered_customer_date"] > mart["order_estimated_delivery_date"]).astype(int),
        np.nan
    )
    
    mart["late_days"] = np.where(
        delivered_mask & has_delivery,
        np.maximum(0, (mart["order_delivered_customer_date"] - mart["order_estimated_delivery_date"]).dt.total_seconds() / 86400),
        np.nan
    )
    
    mart["low_review_flag"] = np.where(
        mart["review_score"].notna(),
        (mart["review_score"] <= 2).astype(int),
        np.nan
    )
    
    print(f"\\n✓ Order mart selesai: {len(mart):,} baris")
    print(f"  - Delivered: {delivered_mask.sum():,}")
    print(f"  - Dengan late_flag: {mart['late_flag'].notna().sum():,}")
    print(f"  - Dengan review: {mart['review_score'].notna().sum():,}")
    
    return mart
'''

# ============================================================
# FILE: src/feature_engineering.py
# ============================================================
FEATURE_ENGINEERING_PY = '''
"""Modul untuk feature engineering dan anti-leakage guards"""

import pandas as pd
import numpy as np
from typing import List, Tuple
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer

from .config import (
    FORBIDDEN_COLS_MODEL_A, 
    FORBIDDEN_COLS_MODEL_B,
    NUMERIC_FEATURES_A,
    CATEGORICAL_FEATURES_A,
)


def check_leakage(feature_cols: List[str], forbidden_cols: List[str], model_name: str):
    """
    Guard: pastikan tidak ada kolom terlarang yang masuk sebagai fitur.
    Raise error jika ditemukan leakage.
    """
    leaking = set(feature_cols) & set(forbidden_cols)
    if leaking:
        raise ValueError(
            f"DATA LEAKAGE TERDETEKSI untuk {model_name}!\\n"
            f"Kolom berikut tidak boleh digunakan: {leaking}"
        )
    print(f"✓ Tidak ada data leakage untuk {model_name}")


def prepare_features_model_a(mart: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
    """
    Siapkan fitur untuk Model A (Late Delivery Prediction)
    HANYA fitur yang diketahui SEBELUM pengiriman dimulai
    """
    # Filter hanya order delivered dengan label valid
    df = mart[
        (mart["order_status"] == "delivered") & 
        (mart["late_flag"].notna())
    ].copy()
    
    print(f"Dataset Model A: {len(df):,} orders")
    
    # Pilih fitur
    features = NUMERIC_FEATURES_A + CATEGORICAL_FEATURES_A
    
    # Check leakage
    check_leakage(features, FORBIDDEN_COLS_MODEL_A, "Model A")
    
    X = df[features].copy()
    y = df["late_flag"].astype(int)
    
    return X, y


def prepare_features_model_b(
    mart: pd.DataFrame, 
    risk_late_scores: pd.Series = None
) -> Tuple[pd.DataFrame, pd.Series]:
    """
    Siapkan fitur untuk Model B (Low Review Prediction)
    Fitur Model A + output prediksi Model A (risk_score_late)
    """
    # Filter order dengan review
    df = mart[mart["low_review_flag"].notna()].copy()
    
    print(f"Dataset Model B: {len(df):,} orders")
    
    # Fitur sama dengan Model A
    features = NUMERIC_FEATURES_A + CATEGORICAL_FEATURES_A
    
    # Tambah risk_late jika tersedia
    if risk_late_scores is not None:
        df["risk_late_score"] = risk_late_scores
        features = features + ["risk_late_score"]
    
    # Check leakage
    check_leakage(features, FORBIDDEN_COLS_MODEL_B, "Model B")
    
    X = df[features].copy()
    y = df["low_review_flag"].astype(int)
    
    return X, y


def build_preprocessor(numeric_features: List[str], categorical_features: List[str]):
    """
    Buat preprocessing pipeline dengan ColumnTransformer
    """
    numeric_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler())
    ])
    
    categorical_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="constant", fill_value="missing")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False))
    ])
    
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, numeric_features),
            ("cat", categorical_transformer, categorical_features)
        ],
        remainder="drop"
    )
    
    return preprocessor


def time_based_split(
    df: pd.DataFrame, 
    date_col: str = "order_purchase_timestamp",
    train_ratio: float = 0.8
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Split data berdasarkan waktu (time-based split)
    untuk menghindari data leakage temporal
    """
    df_sorted = df.sort_values(date_col).reset_index(drop=True)
    
    split_idx = int(len(df_sorted) * train_ratio)
    
    train_df = df_sorted.iloc[:split_idx]
    test_df = df_sorted.iloc[split_idx:]
    
    print(f"Time-based split:")
    print(f"  Train: {len(train_df):,} ({train_df[date_col].min()} to {train_df[date_col].max()})")
    print(f"  Test:  {len(test_df):,} ({test_df[date_col].min()} to {test_df[date_col].max()})")
    
    # Verify no overlap
    train_max = train_df[date_col].max()
    test_min = test_df[date_col].min()
    assert train_max < test_min, "ERROR: Ada overlap antara train dan test!"
    
    return train_df, test_df
'''

# ============================================================
# FILE: src/model_training.py
# ============================================================
MODEL_TRAINING_PY = '''
"""Modul untuk training model ML"""

import pandas as pd
import numpy as np
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Tuple

from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.model_selection import cross_val_score
import joblib

from .config import (
    MODELS_DIR, 
    NUMERIC_FEATURES_A, 
    CATEGORICAL_FEATURES_A,
    RANDOM_STATE
)
from .feature_engineering import build_preprocessor


def train_model(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    model_type: str = "hgb",  # "logistic", "hgb", "rf"
    model_name: str = "model_a"
) -> Pipeline:
    """
    Train model dengan preprocessing pipeline
    """
    print(f"\\nTraining {model_name} dengan {model_type}...")
    print(f"  Shape: {X_train.shape}")
    print(f"  Label distribution: {y_train.value_counts().to_dict()}")
    
    # Identify feature types
    numeric_features = [c for c in X_train.columns if c in NUMERIC_FEATURES_A or c == "risk_late_score"]
    categorical_features = [c for c in X_train.columns if c in CATEGORICAL_FEATURES_A]
    
    # Build preprocessor
    preprocessor = build_preprocessor(numeric_features, categorical_features)
    
    # Select model
    if model_type == "logistic":
        model = LogisticRegression(
            max_iter=1000, 
            class_weight="balanced",
            random_state=RANDOM_STATE
        )
    elif model_type == "hgb":
        model = HistGradientBoostingClassifier(
            max_iter=200,
            learning_rate=0.1,
            max_depth=6,
            random_state=RANDOM_STATE
        )
    elif model_type == "rf":
        model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            class_weight="balanced",
            random_state=RANDOM_STATE,
            n_jobs=-1
        )
    else:
        raise ValueError(f"Unknown model_type: {model_type}")
    
    # Build pipeline
    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", model)
    ])
    
    # Fit
    pipeline.fit(X_train, y_train)
    
    print(f"✓ Model {model_name} selesai ditraining")
    
    return pipeline


def save_model(
    pipeline: Pipeline,
    model_name: str,
    metadata: Dict[str, Any]
) -> Path:
    """Simpan model dan metadata"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Save pipeline
    model_path = MODELS_DIR / f"{model_name}_{timestamp}.joblib"
    joblib.dump(pipeline, model_path)
    
    # Save metadata
    metadata["saved_at"] = timestamp
    metadata["model_path"] = str(model_path)
    metadata_path = MODELS_DIR / f"{model_name}_{timestamp}_metadata.json"
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2, default=str)
    
    print(f"✓ Model disimpan: {model_path}")
    
    return model_path


def load_model(model_path: Path) -> Pipeline:
    """Load model dari file"""
    return joblib.load(model_path)


def list_models() -> list:
    """List semua model yang tersimpan"""
    models = list(MODELS_DIR.glob("*.joblib"))
    return sorted(models, key=lambda x: x.stat().st_mtime, reverse=True)
'''

# ============================================================
# FILE: src/evaluation.py
# ============================================================
EVALUATION_PY = '''
"""Modul untuk evaluasi dan interpretasi model"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from typing import Dict, Any

from sklearn.metrics import (
    roc_auc_score, 
    average_precision_score,
    f1_score,
    precision_score,
    recall_score,
    confusion_matrix,
    classification_report,
    brier_score_loss,
    calibration_curve
)
from sklearn.inspection import permutation_importance


def evaluate_model(
    pipeline,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    model_name: str = "model"
) -> Dict[str, Any]:
    """
    Evaluasi lengkap model
    """
    print(f"\\n=== Evaluasi {model_name} ===")
    
    # Predictions
    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]
    
    # Metrics
    metrics = {
        "roc_auc": roc_auc_score(y_test, y_proba),
        "pr_auc": average_precision_score(y_test, y_proba),
        "f1": f1_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred),
        "recall": recall_score(y_test, y_pred),
        "brier_score": brier_score_loss(y_test, y_proba),
        "n_test": len(y_test),
        "n_positive": int(y_test.sum()),
        "positive_rate": float(y_test.mean()),
    }
    
    print(f"\\nMetrik:")
    print(f"  ROC-AUC:    {metrics['roc_auc']:.4f}")
    print(f"  PR-AUC:     {metrics['pr_auc']:.4f}")
    print(f"  F1 Score:   {metrics['f1']:.4f}")
    print(f"  Precision:  {metrics['precision']:.4f}")
    print(f"  Recall:     {metrics['recall']:.4f}")
    print(f"  Brier:      {metrics['brier_score']:.4f}")
    
    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)
    print(f"\\nConfusion Matrix:")
    print(cm)
    
    # Classification report
    print(f"\\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=["On-Time/Good", "Late/Bad"]))
    
    return metrics


def plot_calibration(y_test, y_proba, model_name: str = "Model"):
    """Plot calibration curve"""
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    
    # Calibration curve
    prob_true, prob_pred = calibration_curve(y_test, y_proba, n_bins=10)
    
    axes[0].plot([0, 1], [0, 1], "k--", label="Perfectly calibrated")
    axes[0].plot(prob_pred, prob_true, "s-", label=model_name)
    axes[0].set_xlabel("Mean predicted probability")
    axes[0].set_ylabel("Fraction of positives")
    axes[0].set_title("Calibration Curve")
    axes[0].legend()
    
    # Distribution of probabilities
    axes[1].hist(y_proba[y_test == 0], bins=30, alpha=0.5, label="Negative (0)")
    axes[1].hist(y_proba[y_test == 1], bins=30, alpha=0.5, label="Positive (1)")
    axes[1].set_xlabel("Predicted probability")
    axes[1].set_ylabel("Count")
    axes[1].set_title("Probability Distribution")
    axes[1].legend()
    
    plt.tight_layout()
    plt.savefig(f"calibration_{model_name.lower().replace(' ', '_')}.png", dpi=150)
    plt.show()
    print(f"✓ Calibration plot disimpan")


def get_feature_importance(pipeline, X_test, y_test, n_repeats=10):
    """
    Hitung feature importance menggunakan permutation importance
    """
    print("\\nMenghitung permutation importance...")
    
    result = permutation_importance(
        pipeline, X_test, y_test,
        n_repeats=n_repeats,
        random_state=42,
        n_jobs=-1
    )
    
    importance_df = pd.DataFrame({
        "feature": X_test.columns,
        "importance_mean": result.importances_mean,
        "importance_std": result.importances_std
    }).sort_values("importance_mean", ascending=False)
    
    print("\\nTop 10 Fitur Paling Penting:")
    print(importance_df.head(10).to_string(index=False))
    
    return importance_df


def analyze_shap(pipeline, X_test, sample_size=500):
    """
    SHAP analysis untuk interpretasi model
    Memerlukan: pip install shap
    """
    try:
        import shap
    except ImportError:
        print("SHAP tidak tersedia. Install dengan: pip install shap")
        return None
    
    print("\\nMenghitung SHAP values...")
    
    # Sample untuk kecepatan
    if len(X_test) > sample_size:
        X_sample = X_test.sample(sample_size, random_state=42)
    else:
        X_sample = X_test
    
    # Transform features
    X_transformed = pipeline.named_steps["preprocessor"].transform(X_sample)
    
    # Get feature names after transformation
    preprocessor = pipeline.named_steps["preprocessor"]
    feature_names = []
    for name, transformer, columns in preprocessor.transformers_:
        if name == "num":
            feature_names.extend(columns)
        elif name == "cat":
            ohe = transformer.named_steps["onehot"]
            cats = ohe.get_feature_names_out(columns)
            feature_names.extend(cats)
    
    # Create explainer
    classifier = pipeline.named_steps["classifier"]
    
    if hasattr(classifier, "predict_proba"):
        explainer = shap.Explainer(classifier, X_transformed, feature_names=feature_names)
        shap_values = explainer(X_transformed)
        
        # Summary plot
        plt.figure(figsize=(10, 8))
        shap.summary_plot(shap_values, X_transformed, feature_names=feature_names, show=False)
        plt.tight_layout()
        plt.savefig("shap_summary.png", dpi=150, bbox_inches="tight")
        plt.show()
        print("✓ SHAP summary plot disimpan")
        
        return shap_values
    else:
        print("Model tidak mendukung SHAP explainer")
        return None
'''

# ============================================================
# FILE: src/inference.py
# ============================================================
INFERENCE_PY = '''
"""Modul untuk inference (prediksi batch dan single)"""

import pandas as pd
import numpy as np
from typing import List, Dict, Any, Union
from pathlib import Path

from .model_training import load_model
from .config import NUMERIC_FEATURES_A, CATEGORICAL_FEATURES_A


def predict_batch(
    pipeline,
    X: pd.DataFrame,
    threshold: float = 0.5
) -> pd.DataFrame:
    """
    Prediksi batch dengan output lengkap
    """
    proba = pipeline.predict_proba(X)[:, 1]
    pred = (proba >= threshold).astype(int)
    
    result = X.copy()
    result["risk_score"] = proba
    result["prediction"] = pred
    result["risk_bucket"] = pd.cut(
        proba,
        bins=[0, 0.2, 0.4, 0.6, 0.8, 1.0],
        labels=["Sangat Rendah", "Rendah", "Sedang", "Tinggi", "Sangat Tinggi"]
    )
    
    return result


def predict_single(
    pipeline,
    features: Dict[str, Any],
    threshold: float = 0.5
) -> Dict[str, Any]:
    """
    Prediksi single order
    """
    # Convert to DataFrame
    X = pd.DataFrame([features])
    
    # Ensure all required columns exist
    required_features = NUMERIC_FEATURES_A + CATEGORICAL_FEATURES_A
    for col in required_features:
        if col not in X.columns:
            X[col] = np.nan if col in NUMERIC_FEATURES_A else "missing"
    
    # Reorder columns
    X = X[required_features]
    
    # Predict
    proba = pipeline.predict_proba(X)[0, 1]
    pred = int(proba >= threshold)
    
    return {
        "risk_score": float(proba),
        "prediction": pred,
        "prediction_label": "Berisiko Tinggi" if pred == 1 else "Normal",
        "recommendation": get_recommendation(proba)
    }


def get_recommendation(risk_score: float) -> str:
    """
    Generate rekomendasi berdasarkan risk score
    """
    if risk_score >= 0.8:
        return (
            "PRIORITAS TINGGI: "
            "1) Eskalasi ke tim operasional segera. "
            "2) Pertimbangkan pengiriman ekspres. "
            "3) Siapkan proactive messaging ke customer."
        )
    elif risk_score >= 0.6:
        return (
            "WASPADA: "
            "1) Monitor pengiriman lebih ketat. "
            "2) Siapkan contingency plan. "
            "3) Pertimbangkan komunikasi proaktif."
        )
    elif risk_score >= 0.4:
        return (
            "SEDANG: "
            "1) Monitoring normal dengan perhatian ekstra. "
            "2) Pastikan estimasi pengiriman akurat."
        )
    else:
        return (
            "NORMAL: "
            "Lanjutkan proses standar. Tidak ada tindakan khusus diperlukan."
        )


def generate_priority_list(
    pipeline,
    X: pd.DataFrame,
    order_ids: pd.Series,
    top_n: int = 50
) -> pd.DataFrame:
    """
    Generate daftar prioritas order berisiko tinggi
    """
    result = predict_batch(pipeline, X)
    result["order_id"] = order_ids.values
    
    priority_list = result.nlargest(top_n, "risk_score")[
        ["order_id", "risk_score", "risk_bucket"]
    ].copy()
    
    priority_list["recommendation"] = priority_list["risk_score"].apply(get_recommendation)
    
    return priority_list
'''

# ============================================================
# FILE: main.py
# ============================================================
MAIN_PY = '''
#!/usr/bin/env python3
"""
Olist Intelligence Suite - ML Pipeline
=======================================
Entry point untuk training dan evaluasi model

Penggunaan:
    python main.py train      # Training model A dan B
    python main.py evaluate   # Evaluasi model tersimpan
    python main.py predict    # Prediksi pada data baru
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.data_loader import load_raw_data, build_order_mart
from src.feature_engineering import (
    prepare_features_model_a,
    prepare_features_model_b,
    time_based_split
)
from src.model_training import train_model, save_model, list_models, load_model
from src.evaluation import evaluate_model, plot_calibration, get_feature_importance
from src.inference import predict_batch, generate_priority_list
from src.config import NUMERIC_FEATURES_A, CATEGORICAL_FEATURES_A


def run_training():
    """Pipeline training lengkap"""
    print("=" * 60)
    print("OLIST INTELLIGENCE SUITE - ML TRAINING PIPELINE")
    print("=" * 60)
    
    # 1. Load data
    print("\\n[1/6] Loading data...")
    raw_data = load_raw_data()
    
    # 2. Build mart
    print("\\n[2/6] Building order mart...")
    mart = build_order_mart(raw_data)
    
    # 3. Prepare features Model A
    print("\\n[3/6] Preparing features for Model A (Late Delivery)...")
    X_a, y_a = prepare_features_model_a(mart)
    
    # Time-based split
    train_idx = int(len(X_a) * 0.8)
    X_train_a, X_test_a = X_a.iloc[:train_idx], X_a.iloc[train_idx:]
    y_train_a, y_test_a = y_a.iloc[:train_idx], y_a.iloc[train_idx:]
    
    print(f"  Train: {len(X_train_a):,}, Test: {len(X_test_a):,}")
    
    # 4. Train Model A
    print("\\n[4/6] Training Model A...")
    pipeline_a = train_model(X_train_a, y_train_a, model_type="hgb", model_name="model_a")
    
    # Evaluate Model A
    metrics_a = evaluate_model(pipeline_a, X_test_a, y_test_a, model_name="Model A")
    
    # Save Model A
    save_model(pipeline_a, "model_a_late_delivery", metadata={
        "model_type": "HistGradientBoostingClassifier",
        "features": list(X_a.columns),
        "metrics": metrics_a,
    })
    
    # 5. Prepare features Model B (with risk_late from Model A)
    print("\\n[5/6] Preparing features for Model B (Low Review)...")
    
    # Generate risk_late scores for all orders with reviews
    mart_with_reviews = mart[mart["low_review_flag"].notna()].copy()
    X_for_risk = mart_with_reviews[NUMERIC_FEATURES_A + CATEGORICAL_FEATURES_A]
    risk_late_scores = pipeline_a.predict_proba(X_for_risk)[:, 1]
    
    X_b, y_b = prepare_features_model_b(mart, risk_late_scores)
    
    # Time-based split for Model B
    train_idx_b = int(len(X_b) * 0.8)
    X_train_b, X_test_b = X_b.iloc[:train_idx_b], X_b.iloc[train_idx_b:]
    y_train_b, y_test_b = y_b.iloc[:train_idx_b], y_b.iloc[train_idx_b:]
    
    # 6. Train Model B
    print("\\n[6/6] Training Model B...")
    pipeline_b = train_model(X_train_b, y_train_b, model_type="hgb", model_name="model_b")
    
    # Evaluate Model B
    metrics_b = evaluate_model(pipeline_b, X_test_b, y_test_b, model_name="Model B")
    
    # Save Model B
    save_model(pipeline_b, "model_b_low_review", metadata={
        "model_type": "HistGradientBoostingClassifier",
        "features": list(X_b.columns),
        "metrics": metrics_b,
        "requires_model_a": True,
    })
    
    print("\\n" + "=" * 60)
    print("TRAINING SELESAI!")
    print("=" * 60)
    print(f"\\nModel tersimpan di: {Path('models').absolute()}")
    
    # Feature importance
    print("\\n--- Feature Importance Model A ---")
    get_feature_importance(pipeline_a, X_test_a, y_test_a)
    
    return pipeline_a, pipeline_b, mart


def run_evaluation():
    """Evaluasi model tersimpan"""
    print("\\nModel tersimpan:")
    for i, model_path in enumerate(list_models()):
        print(f"  [{i+1}] {model_path.name}")
    
    # Load dan evaluasi
    # ... implementasi interaktif


def run_prediction():
    """Prediksi pada data baru"""
    print("\\nMode prediksi...")
    # ... implementasi interaktif


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)
    
    command = sys.argv[1].lower()
    
    if command == "train":
        run_training()
    elif command == "evaluate":
        run_evaluation()
    elif command == "predict":
        run_prediction()
    else:
        print(f"Command tidak dikenal: {command}")
        print(__doc__)
'''

# ============================================================
# FILE: README.md (Bahasa Indonesia)
# ============================================================
README_MD = '''
# Olist Intelligence Suite - ML Pipeline

Panduan lengkap untuk training model Machine Learning prediksi keterlambatan pengiriman 
dan review jelek pada dataset Olist Brazilian E-Commerce.

## Deskripsi Proyek

### Tujuan
1. **Model A - Late Delivery Prediction**: Memprediksi apakah order akan terlambat
2. **Model B - Low Review Prediction**: Memprediksi apakah customer akan memberikan review buruk (score ≤ 2)

### Anti Data Leakage

⚠️ **PENTING**: Pencegahan kebocoran data sangat kritis untuk model yang valid.

**Model A** hanya boleh menggunakan fitur yang diketahui **SEBELUM** pengiriman:
- ✅ Info customer/seller (lokasi, state)
- ✅ Info produk (berat, volume, kategori)
- ✅ Info harga dan pembayaran
- ✅ Estimated delivery date
- ✅ Jarak customer-seller
- ❌ Tanggal delivered (carrier/customer)
- ❌ Review score/text
- ❌ Status order final

**Model B** menggunakan fitur Model A + output prediksi Model A.

## Instalasi

```bash
# Clone atau buat direktori
mkdir olist_ml && cd olist_ml

# Buat virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# atau: venv\\Scripts\\activate  # Windows

# Install dependencies
pip install pandas numpy scikit-learn joblib matplotlib seaborn shap imbalanced-learn
```

## Struktur Direktori

```
olist_ml/
├── data/                    # Letakkan 9 CSV Olist di sini
│   ├── olist_customers_dataset.csv
│   ├── olist_orders_dataset.csv
│   ├── olist_order_items_dataset.csv
│   ├── olist_order_payments_dataset.csv
│   ├── olist_order_reviews_dataset.csv
│   ├── olist_products_dataset.csv
│   ├── olist_sellers_dataset.csv
│   ├── olist_geolocation_dataset.csv
│   └── product_category_name_translation.csv
├── models/                  # Output model tersimpan
├── src/
│   ├── __init__.py
│   ├── config.py
│   ├── data_loader.py
│   ├── feature_engineering.py
│   ├── model_training.py
│   ├── evaluation.py
│   └── inference.py
├── main.py
├── requirements.txt
└── README.md
```

## Cara Menjalankan

### 1. Letakkan Dataset
Download dataset Olist dan letakkan 9 file CSV di folder `data/`.

### 2. Training Model
```bash
python main.py train
```

Output:
- Model tersimpan di `models/` (format .joblib)
- Metadata tersimpan dalam JSON
- Laporan evaluasi dicetak ke console
- Calibration plot disimpan

### 3. Evaluasi
```bash
python main.py evaluate
```

### 4. Prediksi
```bash
python main.py predict
```

## Metrik Evaluasi

- **ROC-AUC**: Area under ROC curve (target > 0.7)
- **PR-AUC**: Area under Precision-Recall curve
- **F1 Score**: Harmonic mean precision-recall
- **Brier Score**: Calibration error (lebih rendah lebih baik)

## Time-Based Split

Data di-split berdasarkan waktu (bukan random) untuk menghindari data leakage temporal:
- 80% awal untuk training
- 20% akhir untuk testing
- Tidak ada overlap waktu antara train dan test

## Interpretasi Model

### Permutation Importance
Menunjukkan fitur mana yang paling berpengaruh terhadap prediksi.

### SHAP Values
(Opsional, jika `shap` terinstall)
Menunjukkan kontribusi setiap fitur untuk setiap prediksi individual.

## Rekomendasi Tindakan

Berdasarkan risk score:

| Risk Score | Bucket | Tindakan |
|------------|--------|----------|
| ≥ 0.8 | Sangat Tinggi | Eskalasi segera, pengiriman ekspres, proactive messaging |
| 0.6 - 0.8 | Tinggi | Monitor ketat, contingency plan |
| 0.4 - 0.6 | Sedang | Monitoring ekstra |
| < 0.4 | Rendah | Proses standar |

## Keterbatasan

1. **Geolocation berbasis ZIP prefix**: Akurasi terbatas
2. **Review text banyak kosong**: NLP terbatas
3. **Dataset historis**: Pola mungkin berubah seiring waktu
4. **Class imbalance**: Late delivery adalah minority class

## Lisensi

MIT License
'''

# ============================================================
# FILE: src/tfjs_export.py (BARU untuk export ke TensorFlow.js)
# ============================================================
TFJS_EXPORT_PY = '''
"""
Modul untuk export model scikit-learn ke TensorFlow.js
Memungkinkan prediksi langsung di browser menggunakan JavaScript.

INSTALASI TAMBAHAN:
pip install tensorflow tensorflowjs
"""

import numpy as np
import pandas as pd
import tensorflow as tf
from pathlib import Path
from typing import List, Dict, Any

from .config import NUMERIC_FEATURES_A, CATEGORICAL_FEATURES_A, MODELS_DIR


# Brazilian states untuk one-hot encoding (harus sama dengan frontend)
BRAZILIAN_STATES = [
    'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN',
    'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
]

PAYMENT_TYPES = ['boleto', 'credit_card', 'debit_card', 'voucher']

TOP_CATEGORIES = [
    'bed_bath_table', 'health_beauty', 'sports_leisure', 'furniture_decor',
    'computers_accessories', 'housewares', 'watches_gifts', 'telephony',
    'garden_tools', 'auto', 'toys', 'cool_stuff', 'perfumery', 'baby',
    'electronics', 'stationery', 'fashion_bags_accessories', 'pet_shop',
    'office_furniture', 'consoles_games'
]


def calculate_input_dimension():
    """Hitung dimensi input untuk neural network"""
    return (
        len(NUMERIC_FEATURES_A) +     # 16 fitur numerik
        len(BRAZILIAN_STATES) * 2 +   # customer_state + seller_state (27 * 2)
        len(TOP_CATEGORIES) +         # category_mode (20)
        len(PAYMENT_TYPES)            # payment_type_mode (4)
    )
    # Total: 16 + 54 + 20 + 4 = 94


def one_hot_encode(value: str, categories: List[str]) -> List[int]:
    """One-hot encode sebuah nilai kategorikal"""
    return [1 if cat == value else 0 for cat in categories]


def compute_normalization_params(X: pd.DataFrame) -> Dict[str, Dict[str, float]]:
    """
    Hitung mean dan std untuk setiap fitur numerik
    Ini harus disimpan dan digunakan di frontend!
    """
    params = {}
    for col in NUMERIC_FEATURES_A:
        if col in X.columns:
            params[col] = {
                "mean": float(X[col].mean()),
                "std": float(X[col].std())
            }
    return params


def preprocess_for_keras(
    X: pd.DataFrame,
    norm_params: Dict[str, Dict[str, float]]
) -> np.ndarray:
    """
    Preprocess data ke format yang sama dengan frontend
    """
    processed_rows = []
    
    for _, row in X.iterrows():
        features = []
        
        # Numerik (normalized)
        for col in NUMERIC_FEATURES_A:
            val = row.get(col, 0)
            if pd.isna(val):
                val = norm_params.get(col, {}).get("mean", 0)
            
            mean = norm_params.get(col, {}).get("mean", 0)
            std = norm_params.get(col, {}).get("std", 1)
            normalized = (val - mean) / (std if std != 0 else 1)
            features.append(normalized)
        
        # Kategorikal (one-hot)
        features.extend(one_hot_encode(
            row.get("customer_state", "SP"), 
            BRAZILIAN_STATES
        ))
        features.extend(one_hot_encode(
            row.get("seller_state_mode", "SP"), 
            BRAZILIAN_STATES
        ))
        features.extend(one_hot_encode(
            row.get("category_mode", "other"), 
            TOP_CATEGORIES
        ))
        features.extend(one_hot_encode(
            row.get("payment_type_mode", "credit_card"), 
            PAYMENT_TYPES
        ))
        
        processed_rows.append(features)
    
    return np.array(processed_rows, dtype=np.float32)


def create_keras_model(input_dim: int) -> tf.keras.Model:
    """
    Buat Keras model dengan arsitektur yang sama dengan frontend
    """
    model = tf.keras.Sequential([
        tf.keras.layers.Dense(64, activation='relu', input_shape=(input_dim,)),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(32, activation='relu'),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(16, activation='relu'),
        tf.keras.layers.Dense(1, activation='sigmoid')
    ])
    
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss='binary_crossentropy',
        metrics=['accuracy', tf.keras.metrics.AUC(name='auc')]
    )
    
    return model


def train_keras_model(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_val: pd.DataFrame = None,
    y_val: pd.Series = None,
    epochs: int = 50,
    batch_size: int = 64
) -> tuple:
    """
    Training Keras model untuk export ke TensorFlow.js
    
    Returns:
        model: Trained Keras model
        norm_params: Normalization parameters
        history: Training history
    """
    print("\\n=== Training Keras Model untuk TensorFlow.js ===")
    
    # Hitung normalization params dari training data
    norm_params = compute_normalization_params(X_train)
    print(f"✓ Normalization params dihitung untuk {len(norm_params)} fitur")
    
    # Preprocess
    X_train_processed = preprocess_for_keras(X_train, norm_params)
    y_train_np = y_train.values
    
    print(f"✓ Training data: {X_train_processed.shape}")
    
    # Validation data
    validation_data = None
    if X_val is not None and y_val is not None:
        X_val_processed = preprocess_for_keras(X_val, norm_params)
        validation_data = (X_val_processed, y_val.values)
        print(f"✓ Validation data: {X_val_processed.shape}")
    
    # Create model
    input_dim = calculate_input_dimension()
    model = create_keras_model(input_dim)
    print(f"\\nModel architecture:")
    model.summary()
    
    # Class weights untuk handle imbalance
    pos_weight = len(y_train_np) / (2 * y_train_np.sum())
    neg_weight = len(y_train_np) / (2 * (len(y_train_np) - y_train_np.sum()))
    class_weight = {0: neg_weight, 1: pos_weight}
    print(f"\\nClass weights: 0={neg_weight:.2f}, 1={pos_weight:.2f}")
    
    # Callbacks
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor='val_loss' if validation_data else 'loss',
            patience=10,
            restore_best_weights=True
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss' if validation_data else 'loss',
            factor=0.5,
            patience=5,
            min_lr=1e-6
        )
    ]
    
    # Training
    print("\\nTraining...")
    history = model.fit(
        X_train_processed,
        y_train_np,
        validation_data=validation_data,
        epochs=epochs,
        batch_size=batch_size,
        class_weight=class_weight,
        callbacks=callbacks,
        verbose=1
    )
    
    return model, norm_params, history


def export_to_tensorflowjs(
    model: tf.keras.Model,
    norm_params: Dict[str, Dict[str, float]],
    output_dir: str = "tfjs_model"
):
    """
    Export Keras model ke format TensorFlow.js
    
    Output:
    - model.json (arsitektur + weights manifest)
    - group1-shard1of1.bin (weights binary)
    - normalization_params.json (untuk frontend)
    - model_metadata.json (info tambahan)
    """
    import json
    import tensorflowjs as tfjs
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Export model
    print(f"\\n=== Exporting to TensorFlow.js ===")
    tfjs.converters.save_keras_model(model, str(output_path))
    print(f"✓ Model exported to: {output_path}")
    
    # Save normalization params
    norm_path = output_path / "normalization_params.json"
    with open(norm_path, "w") as f:
        json.dump(norm_params, f, indent=2)
    print(f"✓ Normalization params saved: {norm_path}")
    
    # Save metadata
    metadata = {
        "input_dimension": calculate_input_dimension(),
        "numeric_features": NUMERIC_FEATURES_A,
        "categorical_features": CATEGORICAL_FEATURES_A,
        "brazilian_states": BRAZILIAN_STATES,
        "payment_types": PAYMENT_TYPES,
        "top_categories": TOP_CATEGORIES,
        "output_type": "sigmoid_probability",
        "threshold": 0.5,
    }
    
    meta_path = output_path / "model_metadata.json"
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"✓ Metadata saved: {meta_path}")
    
    print(f"\\n" + "=" * 50)
    print("EXPORT SELESAI!")
    print("=" * 50)
    print(f"""
File yang dihasilkan:
1. {output_path}/model.json
2. {output_path}/group1-shard1of1.bin
3. {output_path}/normalization_params.json
4. {output_path}/model_metadata.json

LANGKAH SELANJUTNYA:
1. Copy semua file ke folder public/models/ di project Lovable
2. Update src/lib/tfPrediction.ts untuk load model dari /models/model.json
3. Update NORMALIZATION_PARAMS dengan nilai dari normalization_params.json

Contoh load di frontend:
  await tf.loadLayersModel('/models/model.json')
""")


def full_export_pipeline(
    mart: pd.DataFrame,
    output_dir: str = "tfjs_model",
    epochs: int = 50
):
    """
    Pipeline lengkap dari data mart ke TensorFlow.js model
    """
    from .feature_engineering import prepare_features_model_a, time_based_split
    
    print("\\n" + "=" * 60)
    print("TENSORFLOW.JS EXPORT PIPELINE")
    print("=" * 60)
    
    # 1. Prepare features
    print("\\n[1/4] Preparing features...")
    X, y = prepare_features_model_a(mart)
    
    # 2. Time-based split
    print("\\n[2/4] Time-based split...")
    X_train, X_test, y_train, y_test = time_based_split(X, y, test_ratio=0.2)
    
    # 3. Train Keras model
    print("\\n[3/4] Training Keras model...")
    model, norm_params, history = train_keras_model(
        X_train, y_train,
        X_val=X_test, y_val=y_test,
        epochs=epochs
    )
    
    # 4. Evaluate
    print("\\n[4/4] Evaluating...")
    X_test_processed = preprocess_for_keras(X_test, norm_params)
    loss, accuracy, auc = model.evaluate(X_test_processed, y_test.values, verbose=0)
    print(f"  Test Loss: {loss:.4f}")
    print(f"  Test Accuracy: {accuracy:.4f}")
    print(f"  Test AUC: {auc:.4f}")
    
    # 5. Export
    export_to_tensorflowjs(model, norm_params, output_dir)
    
    return model, norm_params


# CLI entrypoint
if __name__ == "__main__":
    import sys
    from .data_loader import load_raw_data, build_order_mart
    
    print("Loading data...")
    raw_data = load_raw_data()
    mart = build_order_mart(raw_data)
    
    output_dir = sys.argv[1] if len(sys.argv) > 1 else "tfjs_model"
    epochs = int(sys.argv[2]) if len(sys.argv) > 2 else 50
    
    full_export_pipeline(mart, output_dir, epochs)
'''

print("=" * 60)
print("PANDUAN PYTHON ML - OLIST INTELLIGENCE SUITE")
print("=" * 60)
print("""
File-file di atas adalah kode Python lengkap yang bisa Anda jalankan 
di luar Lovable untuk training model ML.

LANGKAH PENGGUNAAN:
1. Buat folder olist_ml/
2. Copy setiap file ke lokasi yang sesuai
3. Letakkan 9 CSV Olist di folder data/
4. Jalankan: python main.py train

OUTPUT:
- Model tersimpan di models/ (format .joblib)
- Laporan evaluasi dengan metrik ROC-AUC, PR-AUC, F1
- Feature importance dan SHAP analysis
- Rekomendasi tindakan per risk bucket

===== EXPORT KE TENSORFLOW.JS =====

Untuk menggunakan model di browser (Lovable dashboard):

1. Install tambahan:
   pip install tensorflow tensorflowjs

2. Jalankan export:
   python -c "from src.tfjs_export import full_export_pipeline; ..."
   
   Atau tambahkan ke main.py:
   python main.py export_tfjs

3. Copy hasil ke Lovable:
   - tfjs_model/model.json -> public/models/model.json
   - tfjs_model/*.bin -> public/models/
   - Update NORMALIZATION_PARAMS di src/lib/tfPrediction.ts

4. Model siap digunakan di browser!
""")

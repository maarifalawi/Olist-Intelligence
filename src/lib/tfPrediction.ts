// service prediksi keterlambatan pake tensorflow.js
// kita bisa jalanin ML inference langsung di browser - no backend needed!

import * as tf from '@tensorflow/tfjs';
import type { OrderLevelMart } from './types';

// konfigurasi fitur yang dipake model - harus match sama yang di python
export const MODEL_FEATURES = {
  numeric: [
    'num_items',
    'num_sellers', 
    'num_categories',
    'total_price',
    'total_freight',
    'freight_ratio',
    'weight_g_mean',
    'volume_cm3_mean',
    'distance_km_mean',
    'estimated_lead_time_days',
    'shipping_limit_offset_days_mean',
    'purchase_to_approved_days',
    'payment_value_sum',
    'payment_installments_mean',
    'purchase_dayofweek',
    'purchase_month_num',
  ],
  categorical: [
    'customer_state',
    'seller_state_mode',
    'category_mode',
    'payment_type_mode',
  ],
};

// daftar state brazil buat one-hot encoding
export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN',
  'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

export const PAYMENT_TYPES = ['boleto', 'credit_card', 'debit_card', 'voucher'];

// top kategori produk yang paling sering muncul
export const TOP_CATEGORIES = [
  'bed_bath_table', 'health_beauty', 'sports_leisure', 'furniture_decor',
  'computers_accessories', 'housewares', 'watches_gifts', 'telephony',
  'garden_tools', 'auto', 'toys', 'cool_stuff', 'perfumery', 'baby',
  'electronics', 'stationery', 'fashion_bags_accessories', 'pet_shop',
  'office_furniture', 'consoles_games'
];

// parameter normalisasi - idealnya di-load dari model metadata
// ini placeholder values, ganti pake statistik dari training data
export const NORMALIZATION_PARAMS: Record<string, { mean: number; std: number }> = {
  num_items: { mean: 1.15, std: 0.6 },
  num_sellers: { mean: 1.02, std: 0.15 },
  num_categories: { mean: 1.05, std: 0.25 },
  total_price: { mean: 150, std: 200 },
  total_freight: { mean: 20, std: 15 },
  freight_ratio: { mean: 0.15, std: 0.1 },
  weight_g_mean: { mean: 2000, std: 3000 },
  volume_cm3_mean: { mean: 10000, std: 20000 },
  distance_km_mean: { mean: 500, std: 600 },
  estimated_lead_time_days: { mean: 25, std: 10 },
  shipping_limit_offset_days_mean: { mean: 7, std: 5 },
  purchase_to_approved_days: { mean: 0.5, std: 0.5 },
  payment_value_sum: { mean: 170, std: 220 },
  payment_installments_mean: { mean: 3, std: 3 },
  purchase_dayofweek: { mean: 3, std: 2 },
  purchase_month_num: { mean: 6.5, std: 3.5 },
};

// state model - singleton pattern biar cuma load sekali
let model: tf.LayersModel | null = null;
let isModelLoaded = false;
let isLoading = false;

// interface input buat single prediction
export interface PredictionInput {
  num_items: number;
  num_sellers: number;
  num_categories: number;
  total_price: number;
  total_freight: number;
  weight_g_mean: number;
  volume_cm3_mean: number;
  distance_km_mean: number;
  estimated_lead_time_days: number;
  shipping_limit_offset_days_mean: number;
  purchase_to_approved_days: number;
  payment_value_sum: number;
  payment_installments_mean: number;
  purchase_dayofweek: number;
  purchase_month_num: number;
  customer_state: string;
  seller_state_mode: string;
  category_mode: string;
  payment_type_mode: string;
}

// hasil prediksi lengkap dengan analisis risiko
export interface PredictionResult {
  risk_score: number;
  risk_bucket: 'Sangat Tinggi' | 'Tinggi' | 'Sedang' | 'Rendah';
  recommendations: string[];
  top_risk_factors: Array<{ feature: string; contribution: number }>;
  confidence: 'high' | 'medium' | 'low';
}

// bikin default input buat testing
export function createDefaultInput(): PredictionInput {
  return {
    num_items: 1,
    num_sellers: 1,
    num_categories: 1,
    total_price: 150,
    total_freight: 20,
    weight_g_mean: 1000,
    volume_cm3_mean: 5000,
    distance_km_mean: 300,
    estimated_lead_time_days: 20,
    shipping_limit_offset_days_mean: 5,
    purchase_to_approved_days: 0.5,
    payment_value_sum: 170,
    payment_installments_mean: 1,
    purchase_dayofweek: 1,
    purchase_month_num: 6,
    customer_state: 'SP',
    seller_state_mode: 'SP',
    category_mode: 'bed_bath_table',
    payment_type_mode: 'credit_card',
  };
}

// one-hot encode kategorikal variable
function oneHotEncode(value: string, categories: string[]): number[] {
  return categories.map(cat => value === cat ? 1 : 0);
}

// normalisasi pake z-score
function normalize(value: number, feature: string): number {
  const params = NORMALIZATION_PARAMS[feature];
  if (!params) return value;
  return (value - params.mean) / (params.std || 1);
}

// preprocess input jadi format tensor
export function preprocessInput(input: PredictionInput): number[] {
  const features: number[] = [];
  
  // tambahin fitur numerik yang udah dinormalisasi
  features.push(normalize(input.num_items, 'num_items'));
  features.push(normalize(input.num_sellers, 'num_sellers'));
  features.push(normalize(input.num_categories, 'num_categories'));
  features.push(normalize(input.total_price, 'total_price'));
  features.push(normalize(input.total_freight, 'total_freight'));
  
  // hitung freight_ratio
  const freight_ratio = input.total_freight / (input.total_price + 0.01);
  features.push(normalize(freight_ratio, 'freight_ratio'));
  
  features.push(normalize(input.weight_g_mean, 'weight_g_mean'));
  features.push(normalize(input.volume_cm3_mean, 'volume_cm3_mean'));
  features.push(normalize(input.distance_km_mean, 'distance_km_mean'));
  features.push(normalize(input.estimated_lead_time_days, 'estimated_lead_time_days'));
  features.push(normalize(input.shipping_limit_offset_days_mean, 'shipping_limit_offset_days_mean'));
  features.push(normalize(input.purchase_to_approved_days, 'purchase_to_approved_days'));
  features.push(normalize(input.payment_value_sum, 'payment_value_sum'));
  features.push(normalize(input.payment_installments_mean, 'payment_installments_mean'));
  features.push(normalize(input.purchase_dayofweek, 'purchase_dayofweek'));
  features.push(normalize(input.purchase_month_num, 'purchase_month_num'));
  
  // tambahin one-hot encoded categorical
  features.push(...oneHotEncode(input.customer_state, BRAZILIAN_STATES));
  features.push(...oneHotEncode(input.seller_state_mode, BRAZILIAN_STATES));
  features.push(...oneHotEncode(input.category_mode, TOP_CATEGORIES));
  features.push(...oneHotEncode(input.payment_type_mode, PAYMENT_TYPES));
  
  return features;
}

// hitung dimensi input buat model
export function getInputDimension(): number {
  return MODEL_FEATURES.numeric.length + 
    (BRAZILIAN_STATES.length * 2) + // customer_state + seller_state
    TOP_CATEGORIES.length + 
    PAYMENT_TYPES.length;
}

// load model dari url (production) atau bikin demo model
export async function loadModel(modelUrl?: string): Promise<boolean> {
  if (isModelLoaded && model) return true;
  if (isLoading) return false;
  
  try {
    isLoading = true;
    
    if (modelUrl) {
      // load model tfjs dari url
      model = await tf.loadLayersModel(modelUrl);
      console.log('✓ Model TensorFlow.js loaded dari:', modelUrl);
    } else {
      // bikin demo model buat simulasi
      model = createDemoModel();
      console.log('✓ Demo prediction model created');
    }
    
    isModelLoaded = true;
    return true;
  } catch (error) {
    console.error('Gagal load model:', error);
    return false;
  } finally {
    isLoading = false;
  }
}

// bikin demo model simple neural network
function createDemoModel(): tf.LayersModel {
  const inputDim = getInputDimension();
  
  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [inputDim],
        units: 64,
        activation: 'relu',
        kernelInitializer: 'glorotNormal',
      }),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({
        units: 32,
        activation: 'relu',
        kernelInitializer: 'glorotNormal',
      }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({
        units: 16,
        activation: 'relu',
        kernelInitializer: 'glorotNormal',
      }),
      tf.layers.dense({
        units: 1,
        activation: 'sigmoid',
      }),
    ],
  });
  
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy'],
  });
  
  return model;
}

// hitung faktor risiko dari input
function calculateRiskFactors(input: PredictionInput): Array<{ feature: string; contribution: number }> {
  const factors: Array<{ feature: string; contribution: number }> = [];
  
  // jarak jauh = risiko tinggi
  if (input.distance_km_mean > 800) {
    factors.push({ feature: 'Jarak pengiriman jauh (>800km)', contribution: 0.25 });
  } else if (input.distance_km_mean > 500) {
    factors.push({ feature: 'Jarak pengiriman sedang-jauh', contribution: 0.12 });
  }
  
  // barang berat/besar
  if (input.weight_g_mean > 5000) {
    factors.push({ feature: 'Barang berat (>5kg)', contribution: 0.15 });
  }
  
  if (input.volume_cm3_mean > 30000) {
    factors.push({ feature: 'Volume besar', contribution: 0.1 });
  }
  
  // multi-seller lebih ribet
  if (input.num_sellers > 1) {
    factors.push({ feature: 'Multi-seller order', contribution: 0.15 });
  }
  
  // lead time pendek = risky
  if (input.estimated_lead_time_days < 15) {
    factors.push({ feature: 'Lead time pendek (<15 hari)', contribution: 0.2 });
  }
  
  // approval delay
  if (input.purchase_to_approved_days > 1) {
    factors.push({ feature: 'Delay approval payment', contribution: 0.1 });
  }
  
  // daerah terpencil (utara/timur laut)
  const remoteStates = ['AC', 'AM', 'AP', 'RO', 'RR', 'PA', 'MA', 'PI'];
  if (remoteStates.includes(input.customer_state)) {
    factors.push({ feature: 'Daerah terpencil (customer)', contribution: 0.2 });
  }
  
  // peak season
  if ([11, 12, 1].includes(input.purchase_month_num)) {
    factors.push({ feature: 'Peak season (Nov-Jan)', contribution: 0.08 });
  }
  
  // weekend order
  if (input.purchase_dayofweek >= 5) {
    factors.push({ feature: 'Order weekend', contribution: 0.05 });
  }
  
  // sort dari kontribusi tertinggi
  return factors.sort((a, b) => b.contribution - a.contribution).slice(0, 5);
}

// generate rekomendasi berdasarkan risk score
function generateRecommendations(riskScore: number, factors: Array<{ feature: string; contribution: number }>): string[] {
  const recommendations: string[] = [];
  
  if (riskScore >= 0.8) {
    recommendations.push('⚠️ Eskalasi segera ke tim logistik');
    recommendations.push('Pertimbangkan pengiriman ekspres');
    recommendations.push('Siapkan proactive messaging ke customer');
  } else if (riskScore >= 0.6) {
    recommendations.push('Monitoring ketat status pengiriman');
    recommendations.push('Siapkan contingency plan');
    recommendations.push('Prioritaskan di sorting center');
  } else if (riskScore >= 0.4) {
    recommendations.push('Pantau milestone pengiriman');
    recommendations.push('Review SLA dengan seller/kurir');
  } else {
    recommendations.push('Proses pengiriman standar');
    recommendations.push('Tidak perlu tindakan khusus');
  }
  
  // tambahin rekomendasi spesifik berdasarkan faktor
  const hasDistanceFactor = factors.some(f => f.feature.includes('Jarak'));
  const hasWeightFactor = factors.some(f => f.feature.includes('berat'));
  
  if (hasDistanceFactor && riskScore >= 0.5) {
    recommendations.push('Pilih kurir dengan coverage area luas');
  }
  
  if (hasWeightFactor && riskScore >= 0.5) {
    recommendations.push('Pastikan handling khusus untuk barang berat');
  }
  
  return recommendations;
}

// heuristic prediction kalo model belum ready
function heuristicPredict(input: PredictionInput): number {
  let riskScore = 0.15; // base rate
  
  // jarak jauh = bahaya
  if (input.distance_km_mean > 1000) {
    riskScore += 0.25;
  } else if (input.distance_km_mean > 500) {
    riskScore += 0.12;
  } else if (input.distance_km_mean > 200) {
    riskScore += 0.05;
  }
  
  // barang berat
  if (input.weight_g_mean > 10000) {
    riskScore += 0.15;
  } else if (input.weight_g_mean > 5000) {
    riskScore += 0.08;
  }
  
  // volume gede
  if (input.volume_cm3_mean > 50000) {
    riskScore += 0.1;
  }
  
  // multi-seller ribet
  if (input.num_sellers > 2) {
    riskScore += 0.15;
  } else if (input.num_sellers > 1) {
    riskScore += 0.08;
  }
  
  // lead time kepepet
  if (input.estimated_lead_time_days < 10) {
    riskScore += 0.2;
  } else if (input.estimated_lead_time_days < 15) {
    riskScore += 0.1;
  }
  
  // daerah pelosok
  const remoteStates = ['AC', 'AM', 'AP', 'RO', 'RR'];
  if (remoteStates.includes(input.customer_state)) {
    riskScore += 0.2;
  }
  
  const northeastStates = ['MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA'];
  if (northeastStates.includes(input.customer_state)) {
    riskScore += 0.08;
  }
  
  // beda region customer-seller
  if (input.customer_state !== input.seller_state_mode) {
    riskScore += 0.05;
  }
  
  // approval lama
  if (input.purchase_to_approved_days > 2) {
    riskScore += 0.1;
  } else if (input.purchase_to_approved_days > 1) {
    riskScore += 0.05;
  }
  
  // peak season
  if ([11, 12, 1].includes(input.purchase_month_num)) {
    riskScore += 0.08;
  }
  
  // cap di 0.95
  return Math.min(0.95, Math.max(0.05, riskScore));
}

// predict risiko keterlambatan
export async function predictRisk(input: PredictionInput): Promise<PredictionResult> {
  // hitung faktor risiko dulu
  const topRiskFactors = calculateRiskFactors(input);
  
  let riskScore: number;
  let confidence: 'high' | 'medium' | 'low';
  
  // pake model kalo udah loaded, kalo nggak pake heuristic
  if (model && isModelLoaded) {
    try {
      const features = preprocessInput(input);
      const tensor = tf.tensor2d([features]);
      const prediction = model.predict(tensor) as tf.Tensor;
      const probabilities = await prediction.data();
      
      // blend model + heuristic buat stabilitas
      const modelScore = probabilities[0];
      const heuristicScore = heuristicPredict(input);
      
      // 70% model, 30% heuristic (production: 100% model)
      riskScore = modelScore * 0.7 + heuristicScore * 0.3;
      confidence = 'medium';
      
      // bersihin tensor biar gak memory leak
      tensor.dispose();
      prediction.dispose();
    } catch (error) {
      console.error('Model prediction error, fallback ke heuristic:', error);
      riskScore = heuristicPredict(input);
      confidence = 'low';
    }
  } else {
    // pake heuristic murni
    riskScore = heuristicPredict(input);
    confidence = 'low';
  }
  
  // tentuin bucket risiko
  let riskBucket: PredictionResult['risk_bucket'];
  if (riskScore >= 0.8) {
    riskBucket = 'Sangat Tinggi';
  } else if (riskScore >= 0.6) {
    riskBucket = 'Tinggi';
  } else if (riskScore >= 0.4) {
    riskBucket = 'Sedang';
  } else {
    riskBucket = 'Rendah';
  }
  
  // generate rekomendasi
  const recommendations = generateRecommendations(riskScore, topRiskFactors);
  
  return {
    risk_score: riskScore,
    risk_bucket: riskBucket,
    recommendations,
    top_risk_factors: topRiskFactors,
    confidence,
  };
}

// batch predict buat banyak order sekaligus
export async function batchPredict(orders: OrderLevelMart[]): Promise<Map<string, PredictionResult>> {
  const results = new Map<string, PredictionResult>();
  
  for (const order of orders) {
    const input: PredictionInput = {
      num_items: order.num_items,
      num_sellers: order.num_sellers,
      num_categories: order.num_categories,
      total_price: order.total_price,
      total_freight: order.total_freight,
      weight_g_mean: order.weight_g_mean ?? 1000,
      volume_cm3_mean: order.volume_cm3_mean ?? 5000,
      distance_km_mean: order.distance_km_mean ?? 300,
      estimated_lead_time_days: order.estimated_lead_time_days ?? 20,
      shipping_limit_offset_days_mean: order.shipping_limit_offset_days_mean ?? 5,
      purchase_to_approved_days: order.purchase_to_approved_days ?? 0.5,
      payment_value_sum: order.payment_value_sum,
      payment_installments_mean: order.payment_installments_mean,
      purchase_dayofweek: order.purchase_dayofweek,
      purchase_month_num: order.order_purchase_timestamp.getMonth() + 1,
      customer_state: order.customer_state,
      seller_state_mode: order.seller_states[0] ?? 'SP',
      category_mode: order.categories_english[0] ?? 'other',
      payment_type_mode: order.payment_type_mode ?? 'credit_card',
    };
    
    const result = await predictRisk(input);
    results.set(order.order_id, result);
  }
  
  return results;
}

// cek status model
export function getModelStatus(): { loaded: boolean; loading: boolean; type: string } {
  return {
    loaded: isModelLoaded,
    loading: isLoading,
    type: model ? 'TensorFlow.js' : 'None',
  };
}

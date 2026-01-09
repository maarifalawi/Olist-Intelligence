// Olist Dataset Types

export interface Customer {
  customer_id: string;
  customer_unique_id: string;
  customer_zip_code_prefix: string;
  customer_city: string;
  customer_state: string;
}

export interface Order {
  order_id: string;
  customer_id: string;
  order_status: string;
  order_purchase_timestamp: string;
  order_approved_at: string | null;
  order_delivered_carrier_date: string | null;
  order_delivered_customer_date: string | null;
  order_estimated_delivery_date: string;
}

export interface OrderItem {
  order_id: string;
  order_item_id: number;
  product_id: string;
  seller_id: string;
  shipping_limit_date: string;
  price: number;
  freight_value: number;
}

export interface Payment {
  order_id: string;
  payment_sequential: number;
  payment_type: string;
  payment_installments: number;
  payment_value: number;
}

export interface Review {
  review_id: string;
  order_id: string;
  review_score: number;
  review_comment_title: string | null;
  review_comment_message: string | null;
  review_creation_date: string;
  review_answer_timestamp: string;
}

export interface Product {
  product_id: string;
  product_category_name: string | null;
  product_name_lenght: number | null;
  product_description_lenght: number | null;
  product_photos_qty: number | null;
  product_weight_g: number | null;
  product_length_cm: number | null;
  product_height_cm: number | null;
  product_width_cm: number | null;
}

export interface Seller {
  seller_id: string;
  seller_zip_code_prefix: string;
  seller_city: string;
  seller_state: string;
}

export interface Geolocation {
  geolocation_zip_code_prefix: string;
  geolocation_lat: number;
  geolocation_lng: number;
  geolocation_city: string;
  geolocation_state: string;
}

export interface CategoryTranslation {
  product_category_name: string;
  product_category_name_english: string;
}

// Processed Data Mart Types
export interface OrderLevelMart {
  order_id: string;
  customer_id: string;
  customer_unique_id: string;
  customer_city: string;
  customer_state: string;
  customer_lat: number | null;
  customer_lng: number | null;
  order_status: string;
  order_purchase_timestamp: Date;
  order_approved_at: Date | null;
  order_delivered_carrier_date: Date | null;
  order_delivered_customer_date: Date | null;
  order_estimated_delivery_date: Date;
  purchase_date: string;
  purchase_week: string;
  purchase_month: string;
  purchase_year: number;
  purchase_dayofweek: number;
  
  // Aggregated item info
  num_items: number;
  num_sellers: number;
  num_categories: number;
  total_price: number;
  total_freight: number;
  freight_ratio: number;
  weight_g_mean: number | null;
  weight_g_max: number | null;
  volume_cm3_mean: number | null;
  volume_cm3_max: number | null;
  
  // Distance
  distance_km_mean: number | null;
  distance_km_max: number | null;
  distance_km_min: number | null;
  geo_missing_flag: boolean;
  
  // Time intervals (days)
  purchase_to_approved_days: number | null;
  approved_to_carrier_days: number | null;
  carrier_to_customer_days: number | null;
  purchase_to_customer_days: number | null;
  estimated_lead_time_days: number | null;
  shipping_limit_offset_days_mean: number | null;
  
  // Missing flags
  approved_missing: boolean;
  carrier_missing: boolean;
  delivered_missing: boolean;
  
  // Payment aggregations
  payment_value_sum: number;
  payment_sequential_count: number;
  payment_installments_mean: number;
  payment_type_mode: string | null;
  
  // Review aggregations
  review_score: number | null;
  review_count: number;
  review_text: string | null;
  
  // Labels
  late_flag: number | null;
  late_days: number | null;
  low_review_flag: number | null;
  
  // Categories (for filtering)
  categories_english: string[];
  seller_states: string[];
}

// Upload state tracking
export interface FileUploadStatus {
  filename: string;
  required_name: string;
  uploaded: boolean;
  rows?: number;
  columns?: number;
  validation_errors?: string[];
}

export interface DatasetState {
  customers: Customer[];
  orders: Order[];
  order_items: OrderItem[];
  payments: Payment[];
  reviews: Review[];
  products: Product[];
  sellers: Seller[];
  geolocation: Geolocation[];
  translations: CategoryTranslation[];
}

export interface ProcessedDataState {
  orderMart: OrderLevelMart[];
  dataQuality: DataQualityReport;
  buildTimestamp: Date;
}

export interface DataQualityReport {
  total_orders: number;
  delivered_orders: number;
  orders_with_reviews: number;
  orders_with_geo: number;
  negative_intervals: number;
  extreme_distances: number;
  missing_summary: Record<string, number>;
}

// Dashboard filter state
export interface DashboardFilters {
  dateRange: { start: Date | null; end: Date | null };
  customerStates: string[];
  sellerStates: string[];
  categories: string[];
  paymentTypes: string[];
}

// KPI types
export interface KPIMetric {
  label: string;
  value: number | string;
  format: 'number' | 'percent' | 'currency' | 'days';
  delta?: number;
  deltaType?: 'positive' | 'negative' | 'neutral';
}

// Chart data types
export interface TimeSeriesPoint {
  date: string;
  value: number;
  label?: string;
}

export interface BreakdownItem {
  category: string;
  value: number;
  count: number;
  percentage?: number;
}

export interface SellerLeaderboard {
  seller_id: string;
  seller_city: string;
  seller_state: string;
  total_orders: number;
  late_orders: number;
  late_rate: number;
  avg_late_days: number;
  total_revenue: number;
}

export interface CohortData {
  cohort: string;
  retention: Record<number, number>;
  customers: number;
}

// Required file configurations
export const REQUIRED_FILES = [
  {
    key: 'customers',
    filename: 'olist_customers_dataset.csv',
    display: 'Customers',
    required_columns: ['customer_id', 'customer_unique_id', 'customer_zip_code_prefix', 'customer_city', 'customer_state'],
  },
  {
    key: 'orders',
    filename: 'olist_orders_dataset.csv',
    display: 'Orders',
    required_columns: ['order_id', 'customer_id', 'order_status', 'order_purchase_timestamp', 'order_approved_at', 'order_delivered_carrier_date', 'order_delivered_customer_date', 'order_estimated_delivery_date'],
  },
  {
    key: 'order_items',
    filename: 'olist_order_items_dataset.csv',
    display: 'Order Items',
    required_columns: ['order_id', 'order_item_id', 'product_id', 'seller_id', 'shipping_limit_date', 'price', 'freight_value'],
  },
  {
    key: 'payments',
    filename: 'olist_order_payments_dataset.csv',
    display: 'Payments',
    required_columns: ['order_id', 'payment_sequential', 'payment_type', 'payment_installments', 'payment_value'],
  },
  {
    key: 'reviews',
    filename: 'olist_order_reviews_dataset.csv',
    display: 'Reviews',
    required_columns: ['review_id', 'order_id', 'review_score', 'review_comment_title', 'review_comment_message', 'review_creation_date', 'review_answer_timestamp'],
  },
  {
    key: 'products',
    filename: 'olist_products_dataset.csv',
    display: 'Products',
    required_columns: ['product_id', 'product_category_name', 'product_name_lenght', 'product_description_lenght', 'product_photos_qty', 'product_weight_g', 'product_length_cm', 'product_height_cm', 'product_width_cm'],
  },
  {
    key: 'sellers',
    filename: 'olist_sellers_dataset.csv',
    display: 'Sellers',
    required_columns: ['seller_id', 'seller_zip_code_prefix', 'seller_city', 'seller_state'],
  },
  {
    key: 'geolocation',
    filename: 'olist_geolocation_dataset.csv',
    display: 'Geolocation',
    required_columns: ['geolocation_zip_code_prefix', 'geolocation_lat', 'geolocation_lng', 'geolocation_city', 'geolocation_state'],
  },
  {
    key: 'translations',
    filename: 'product_category_name_translation.csv',
    display: 'Category Translations',
    required_columns: ['product_category_name', 'product_category_name_english'],
  },
] as const;

export type FileKey = typeof REQUIRED_FILES[number]['key'];

// Order status types
export const ORDER_STATUSES = [
  'delivered',
  'shipped',
  'canceled',
  'unavailable',
  'invoiced',
  'processing',
  'created',
  'approved',
] as const;

// Payment types
export const PAYMENT_TYPES = [
  'credit_card',
  'boleto',
  'voucher',
  'debit_card',
  'not_defined',
] as const;

// Brazilian states
export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

// Distance bins for analysis
export const DISTANCE_BINS = [
  { min: 0, max: 100, label: '0-100 km' },
  { min: 100, max: 500, label: '100-500 km' },
  { min: 500, max: 1000, label: '500-1000 km' },
  { min: 1000, max: 2000, label: '1000-2000 km' },
  { min: 2000, max: Infinity, label: '>2000 km' },
] as const;

// Chart color palette (minimal, professional)
export const CHART_COLORS = {
  primary: 'hsl(173, 58%, 39%)',
  secondary: 'hsl(220, 9%, 46%)',
  success: 'hsl(142, 71%, 45%)',
  warning: 'hsl(38, 92%, 50%)',
  danger: 'hsl(0, 84%, 60%)',
  info: 'hsl(199, 89%, 48%)',
  muted: 'hsl(220, 14%, 96%)',
};

export const CHART_PALETTE = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.info,
  CHART_COLORS.warning,
  CHART_COLORS.danger,
];

// Format helpers
export const FORMAT_LOCALE = 'id-ID';
export const CURRENCY = 'BRL';

// Data quality thresholds
export const DATA_QUALITY_THRESHOLDS = {
  MAX_DISTANCE_KM: 5000,
  MAX_WEIGHT_G: 100000,
  MAX_VOLUME_CM3: 1000000,
  MAX_LEAD_TIME_DAYS: 180,
};

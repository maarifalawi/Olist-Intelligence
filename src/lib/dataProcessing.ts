import {
  Customer,
  Order,
  OrderItem,
  Payment,
  Review,
  Product,
  Seller,
  Geolocation,
  CategoryTranslation,
  OrderLevelMart,
  DataQualityReport,
  DatasetState,
} from './types';
import { parseCSV } from './validation';
import { DATA_QUALITY_THRESHOLDS } from './constants';

/**
 * Calculate Haversine distance between two coordinates
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate median of array
 */
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate mode of string array
 */
function mode(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const counts: Record<string, number> = {};
  arr.forEach(v => {
    counts[v] = (counts[v] || 0) + 1;
  });
  let maxCount = 0;
  let modeValue: string | null = null;
  for (const [key, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      modeValue = key;
    }
  }
  return modeValue;
}

/**
 * Parse date string to Date object
 */
function parseDate(dateStr: string | null): Date | null {
  if (!dateStr || dateStr === '' || dateStr === 'null') return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Calculate days between two dates
 */
function daysBetween(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  const diff = end.getTime() - start.getTime();
  return diff / (1000 * 60 * 60 * 24);
}

/**
 * Parse all raw CSV files into typed datasets
 */
export function parseDatasets(files: Record<string, string>): DatasetState {
  const customers = parseCSV<Customer>(files.customers || '').data.map(c => ({
    ...c,
    customer_id: String(c.customer_id).replace(/"/g, ''),
    customer_unique_id: String(c.customer_unique_id).replace(/"/g, ''),
    customer_zip_code_prefix: String(c.customer_zip_code_prefix).replace(/"/g, ''),
    customer_city: String(c.customer_city || '').toLowerCase().trim(),
    customer_state: String(c.customer_state || '').toUpperCase().trim(),
  }));

  const orders = parseCSV<Order>(files.orders || '').data.map(o => ({
    ...o,
    order_id: String(o.order_id).replace(/"/g, ''),
    customer_id: String(o.customer_id).replace(/"/g, ''),
    order_status: String(o.order_status).toLowerCase().trim(),
  }));

  const order_items = parseCSV<OrderItem>(files.order_items || '').data.map(oi => ({
    ...oi,
    order_id: String(oi.order_id).replace(/"/g, ''),
    order_item_id: Number(oi.order_item_id) || 1,
    product_id: String(oi.product_id).replace(/"/g, ''),
    seller_id: String(oi.seller_id).replace(/"/g, ''),
    price: Number(oi.price) || 0,
    freight_value: Number(oi.freight_value) || 0,
  }));

  const payments = parseCSV<Payment>(files.payments || '').data.map(p => ({
    ...p,
    order_id: String(p.order_id).replace(/"/g, ''),
    payment_sequential: Number(p.payment_sequential) || 1,
    payment_type: String(p.payment_type).toLowerCase().trim(),
    payment_installments: Number(p.payment_installments) || 1,
    payment_value: Number(p.payment_value) || 0,
  }));

  const reviews = parseCSV<Review>(files.reviews || '').data.map(r => ({
    ...r,
    review_id: String(r.review_id).replace(/"/g, ''),
    order_id: String(r.order_id).replace(/"/g, ''),
    review_score: Number(r.review_score) || 0,
    review_comment_title: r.review_comment_title || null,
    review_comment_message: r.review_comment_message || null,
  }));

  const products = parseCSV<Product>(files.products || '').data.map(p => ({
    ...p,
    product_id: String(p.product_id).replace(/"/g, ''),
    product_category_name: p.product_category_name || null,
    product_name_lenght: Number(p.product_name_lenght) || null,
    product_description_lenght: Number(p.product_description_lenght) || null,
    product_photos_qty: Number(p.product_photos_qty) || null,
    product_weight_g: Number(p.product_weight_g) || null,
    product_length_cm: Number(p.product_length_cm) || null,
    product_height_cm: Number(p.product_height_cm) || null,
    product_width_cm: Number(p.product_width_cm) || null,
  }));

  const sellers = parseCSV<Seller>(files.sellers || '').data.map(s => ({
    ...s,
    seller_id: String(s.seller_id).replace(/"/g, ''),
    seller_zip_code_prefix: String(s.seller_zip_code_prefix).replace(/"/g, ''),
    seller_city: String(s.seller_city || '').toLowerCase().trim(),
    seller_state: String(s.seller_state || '').toUpperCase().trim(),
  }));

  const geolocation = parseCSV<Geolocation>(files.geolocation || '').data.map(g => ({
    ...g,
    geolocation_zip_code_prefix: String(g.geolocation_zip_code_prefix).replace(/"/g, ''),
    geolocation_lat: Number(g.geolocation_lat) || 0,
    geolocation_lng: Number(g.geolocation_lng) || 0,
    geolocation_city: String(g.geolocation_city || '').toLowerCase().trim(),
    geolocation_state: String(g.geolocation_state || '').toUpperCase().trim(),
  }));

  const translations = parseCSV<CategoryTranslation>(files.translations || '').data.map(t => ({
    ...t,
    product_category_name: String(t.product_category_name || '').trim(),
    product_category_name_english: String(t.product_category_name_english || '').trim(),
  }));

  return {
    customers,
    orders,
    order_items: order_items,
    payments,
    reviews,
    products,
    sellers,
    geolocation,
    translations,
  };
}

/**
 * Build the order-level data mart
 */
export function buildOrderMart(
  datasets: DatasetState,
  onProgress?: (progress: number, message: string) => void
): { mart: OrderLevelMart[]; quality: DataQualityReport } {
  const {
    customers,
    orders,
    order_items,
    payments,
    reviews,
    products,
    sellers,
    geolocation,
    translations,
  } = datasets;

  onProgress?.(5, 'Membangun index lookup...');

  // Build lookup maps
  const customerMap = new Map(customers.map(c => [c.customer_id, c]));
  const productMap = new Map(products.map(p => [p.product_id, p]));
  const sellerMap = new Map(sellers.map(s => [s.seller_id, s]));
  const translationMap = new Map(translations.map(t => [t.product_category_name, t.product_category_name_english]));

  onProgress?.(10, 'Menghitung centroid geolocation...');

  // Calculate geolocation centroids (median)
  const geoByZip = new Map<string, { lats: number[]; lngs: number[] }>();
  for (const g of geolocation) {
    const zip = g.geolocation_zip_code_prefix;
    if (!geoByZip.has(zip)) {
      geoByZip.set(zip, { lats: [], lngs: [] });
    }
    const entry = geoByZip.get(zip)!;
    if (g.geolocation_lat !== 0 && g.geolocation_lng !== 0) {
      entry.lats.push(g.geolocation_lat);
      entry.lngs.push(g.geolocation_lng);
    }
  }

  const geoCentroids = new Map<string, { lat: number; lng: number }>();
  for (const [zip, coords] of geoByZip) {
    if (coords.lats.length > 0) {
      geoCentroids.set(zip, {
        lat: median(coords.lats),
        lng: median(coords.lngs),
      });
    }
  }

  onProgress?.(20, 'Agregasi items per order...');

  // Aggregate order items
  const itemsByOrder = new Map<string, OrderItem[]>();
  for (const item of order_items) {
    if (!itemsByOrder.has(item.order_id)) {
      itemsByOrder.set(item.order_id, []);
    }
    itemsByOrder.get(item.order_id)!.push(item);
  }

  onProgress?.(30, 'Agregasi payments per order...');

  // Aggregate payments
  const paymentsByOrder = new Map<string, Payment[]>();
  for (const p of payments) {
    if (!paymentsByOrder.has(p.order_id)) {
      paymentsByOrder.set(p.order_id, []);
    }
    paymentsByOrder.get(p.order_id)!.push(p);
  }

  onProgress?.(40, 'Agregasi reviews per order...');

  // Aggregate reviews
  const reviewsByOrder = new Map<string, Review[]>();
  for (const r of reviews) {
    if (!reviewsByOrder.has(r.order_id)) {
      reviewsByOrder.set(r.order_id, []);
    }
    reviewsByOrder.get(r.order_id)!.push(r);
  }

  onProgress?.(50, 'Membangun order mart...');

  // Build order mart
  const mart: OrderLevelMart[] = [];
  let negativeIntervals = 0;
  let extremeDistances = 0;
  const missingSummary: Record<string, number> = {};

  const totalOrders = orders.length;
  let processedOrders = 0;

  for (const order of orders) {
    processedOrders++;
    if (processedOrders % 10000 === 0) {
      onProgress?.(50 + (processedOrders / totalOrders) * 40, `Memproses order ${processedOrders}/${totalOrders}...`);
    }

    const customer = customerMap.get(order.customer_id);
    if (!customer) {
      missingSummary['customer_not_found'] = (missingSummary['customer_not_found'] || 0) + 1;
      continue;
    }

    const items = itemsByOrder.get(order.order_id) || [];
    const orderPayments = paymentsByOrder.get(order.order_id) || [];
    const orderReviews = reviewsByOrder.get(order.order_id) || [];

    // Parse timestamps
    const purchaseTimestamp = parseDate(order.order_purchase_timestamp);
    const approvedAt = parseDate(order.order_approved_at);
    const carrierDate = parseDate(order.order_delivered_carrier_date);
    const customerDate = parseDate(order.order_delivered_customer_date);
    const estimatedDate = parseDate(order.order_estimated_delivery_date);

    if (!purchaseTimestamp || !estimatedDate) {
      missingSummary['invalid_timestamps'] = (missingSummary['invalid_timestamps'] || 0) + 1;
      continue;
    }

    // Customer geo
    const customerGeo = geoCentroids.get(customer.customer_zip_code_prefix);
    const customerLat = customerGeo?.lat ?? null;
    const customerLng = customerGeo?.lng ?? null;

    // Collect item-level data
    const sellerIds = new Set<string>();
    const categoryNames = new Set<string>();
    const distances: number[] = [];
    const weights: number[] = [];
    const volumes: number[] = [];
    const shippingOffsets: number[] = [];
    let totalPrice = 0;
    let totalFreight = 0;

    for (const item of items) {
      totalPrice += item.price;
      totalFreight += item.freight_value;
      sellerIds.add(item.seller_id);

      const product = productMap.get(item.product_id);
      if (product?.product_category_name) {
        categoryNames.add(product.product_category_name);
      }

      if (product?.product_weight_g) {
        weights.push(product.product_weight_g);
      }

      if (product?.product_length_cm && product?.product_height_cm && product?.product_width_cm) {
        const vol = product.product_length_cm * product.product_height_cm * product.product_width_cm;
        volumes.push(vol);
      }

      // Calculate distance
      const seller = sellerMap.get(item.seller_id);
      if (seller && customerLat !== null && customerLng !== null) {
        const sellerGeo = geoCentroids.get(seller.seller_zip_code_prefix);
        if (sellerGeo) {
          const dist = haversineDistance(customerLat, customerLng, sellerGeo.lat, sellerGeo.lng);
          if (dist <= DATA_QUALITY_THRESHOLDS.MAX_DISTANCE_KM) {
            distances.push(dist);
          } else {
            extremeDistances++;
          }
        }
      }

      // Shipping limit offset
      const shippingLimit = parseDate(item.shipping_limit_date);
      if (shippingLimit && purchaseTimestamp) {
        const offset = daysBetween(purchaseTimestamp, shippingLimit);
        if (offset !== null) {
          shippingOffsets.push(offset);
        }
      }
    }

    // Time intervals
    const purchaseToApproved = daysBetween(purchaseTimestamp, approvedAt);
    const approvedToCarrier = daysBetween(approvedAt, carrierDate);
    const carrierToCustomer = daysBetween(carrierDate, customerDate);
    const purchaseToCustomer = daysBetween(purchaseTimestamp, customerDate);
    const estimatedLeadTime = daysBetween(purchaseTimestamp, estimatedDate);

    // Check for negative intervals
    if (
      (purchaseToApproved !== null && purchaseToApproved < 0) ||
      (approvedToCarrier !== null && approvedToCarrier < 0) ||
      (carrierToCustomer !== null && carrierToCustomer < 0)
    ) {
      negativeIntervals++;
    }

    // Payment aggregations
    const paymentValueSum = orderPayments.reduce((sum, p) => sum + p.payment_value, 0);
    const paymentTypes = orderPayments.map(p => p.payment_type);
    const installmentsMean = orderPayments.length > 0
      ? orderPayments.reduce((sum, p) => sum + p.payment_installments, 0) / orderPayments.length
      : 0;

    // Review aggregations
    const reviewScores = orderReviews.map(r => r.review_score).filter(s => s > 0);
    const avgReviewScore = reviewScores.length > 0
      ? reviewScores.reduce((a, b) => a + b, 0) / reviewScores.length
      : null;
    const reviewTexts = orderReviews
      .map(r => [r.review_comment_title, r.review_comment_message].filter(Boolean).join(' '))
      .filter(t => t.length > 0);

    // Labels
    let lateFlag: number | null = null;
    let lateDays: number | null = null;
    if (order.order_status === 'delivered' && customerDate && estimatedDate) {
      const diff = daysBetween(estimatedDate, customerDate);
      if (diff !== null) {
        lateFlag = diff > 0 ? 1 : 0;
        lateDays = Math.max(0, diff);
      }
    }

    const lowReviewFlag = avgReviewScore !== null ? (avgReviewScore <= 2 ? 1 : 0) : null;

    // Categories in English
    const categoriesEnglish = Array.from(categoryNames).map(
      cat => translationMap.get(cat) || cat
    );

    // Seller states
    const sellerStates = Array.from(sellerIds)
      .map(id => sellerMap.get(id)?.seller_state)
      .filter((s): s is string => !!s);

    // Format date strings
    const purchaseDate = purchaseTimestamp.toISOString().split('T')[0];
    const weekStart = new Date(purchaseTimestamp);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const purchaseWeek = weekStart.toISOString().split('T')[0];
    const purchaseMonth = `${purchaseTimestamp.getFullYear()}-${String(purchaseTimestamp.getMonth() + 1).padStart(2, '0')}`;

    mart.push({
      order_id: order.order_id,
      customer_id: customer.customer_id,
      customer_unique_id: customer.customer_unique_id,
      customer_city: customer.customer_city,
      customer_state: customer.customer_state,
      customer_lat: customerLat,
      customer_lng: customerLng,
      order_status: order.order_status,
      order_purchase_timestamp: purchaseTimestamp,
      order_approved_at: approvedAt,
      order_delivered_carrier_date: carrierDate,
      order_delivered_customer_date: customerDate,
      order_estimated_delivery_date: estimatedDate,
      purchase_date: purchaseDate,
      purchase_week: purchaseWeek,
      purchase_month: purchaseMonth,
      purchase_year: purchaseTimestamp.getFullYear(),
      purchase_dayofweek: purchaseTimestamp.getDay(),

      num_items: items.length,
      num_sellers: sellerIds.size,
      num_categories: categoryNames.size,
      total_price: totalPrice,
      total_freight: totalFreight,
      freight_ratio: totalPrice > 0 ? totalFreight / totalPrice : 0,
      weight_g_mean: weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : null,
      weight_g_max: weights.length > 0 ? Math.max(...weights) : null,
      volume_cm3_mean: volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : null,
      volume_cm3_max: volumes.length > 0 ? Math.max(...volumes) : null,

      distance_km_mean: distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : null,
      distance_km_max: distances.length > 0 ? Math.max(...distances) : null,
      distance_km_min: distances.length > 0 ? Math.min(...distances) : null,
      geo_missing_flag: customerLat === null || distances.length === 0,

      purchase_to_approved_days: purchaseToApproved,
      approved_to_carrier_days: approvedToCarrier,
      carrier_to_customer_days: carrierToCustomer,
      purchase_to_customer_days: purchaseToCustomer,
      estimated_lead_time_days: estimatedLeadTime,
      shipping_limit_offset_days_mean: shippingOffsets.length > 0
        ? shippingOffsets.reduce((a, b) => a + b, 0) / shippingOffsets.length
        : null,

      approved_missing: approvedAt === null,
      carrier_missing: carrierDate === null,
      delivered_missing: customerDate === null,

      payment_value_sum: paymentValueSum,
      payment_sequential_count: orderPayments.length,
      payment_installments_mean: installmentsMean,
      payment_type_mode: mode(paymentTypes),

      review_score: avgReviewScore,
      review_count: orderReviews.length,
      review_text: reviewTexts.length > 0 ? reviewTexts.join(' | ') : null,

      late_flag: lateFlag,
      late_days: lateDays,
      low_review_flag: lowReviewFlag,

      categories_english: categoriesEnglish,
      seller_states: sellerStates,
    });
  }

  onProgress?.(95, 'Menghitung laporan kualitas data...');

  // Build quality report
  const deliveredOrders = mart.filter(m => m.order_status === 'delivered').length;
  const ordersWithReviews = mart.filter(m => m.review_count > 0).length;
  const ordersWithGeo = mart.filter(m => !m.geo_missing_flag).length;

  const quality: DataQualityReport = {
    total_orders: mart.length,
    delivered_orders: deliveredOrders,
    orders_with_reviews: ordersWithReviews,
    orders_with_geo: ordersWithGeo,
    negative_intervals: negativeIntervals,
    extreme_distances: extremeDistances,
    missing_summary: missingSummary,
  };

  onProgress?.(100, 'Selesai!');

  return { mart, quality };
}

/**
 * Export mart to CSV format
 */
export function exportToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  
  for (const row of data) {
    const values = headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      if (Array.isArray(val)) return `"${val.join(';')}"`;
      if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      if (val instanceof Date) return val.toISOString();
      return String(val);
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

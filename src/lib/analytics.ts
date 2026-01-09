import { OrderLevelMart, DashboardFilters, TimeSeriesPoint, BreakdownItem, SellerLeaderboard, CohortData } from './types';
import { DISTANCE_BINS } from './constants';

/**
 * Apply filters to order mart
 */
export function filterOrders(
  orders: OrderLevelMart[],
  filters: DashboardFilters
): OrderLevelMart[] {
  return orders.filter(order => {
    // Date range filter
    if (filters.dateRange.start && order.order_purchase_timestamp < filters.dateRange.start) {
      return false;
    }
    if (filters.dateRange.end && order.order_purchase_timestamp > filters.dateRange.end) {
      return false;
    }

    // Customer state filter
    if (filters.customerStates.length > 0 && !filters.customerStates.includes(order.customer_state)) {
      return false;
    }

    // Seller state filter
    if (filters.sellerStates.length > 0 && !order.seller_states.some(s => filters.sellerStates.includes(s))) {
      return false;
    }

    // Category filter
    if (filters.categories.length > 0 && !order.categories_english.some(c => filters.categories.includes(c))) {
      return false;
    }

    // Payment type filter
    if (filters.paymentTypes.length > 0 && order.payment_type_mode && !filters.paymentTypes.includes(order.payment_type_mode)) {
      return false;
    }

    return true;
  });
}

/**
 * Get unique values for filter dropdowns
 */
export function getFilterOptions(orders: OrderLevelMart[]) {
  const customerStates = [...new Set(orders.map(o => o.customer_state))].sort();
  const sellerStates = [...new Set(orders.flatMap(o => o.seller_states))].sort();
  const categories = [...new Set(orders.flatMap(o => o.categories_english))].sort();
  const paymentTypes = [...new Set(orders.map(o => o.payment_type_mode).filter((t): t is string => !!t))].sort();
  
  return { customerStates, sellerStates, categories, paymentTypes };
}

/**
 * Calculate KPIs for ops dashboard
 */
export function calculateOpsKPIs(orders: OrderLevelMart[]) {
  const delivered = orders.filter(o => o.order_status === 'delivered');
  const withLateFlag = delivered.filter(o => o.late_flag !== null);
  const lateOrders = withLateFlag.filter(o => o.late_flag === 1);
  
  const totalOrders = orders.length;
  const deliveredCount = delivered.length;
  const lateCount = lateOrders.length;
  const lateRate = withLateFlag.length > 0 ? lateCount / withLateFlag.length : 0;
  
  const avgLeadTime = delivered.filter(o => o.purchase_to_customer_days !== null)
    .reduce((sum, o, _, arr) => sum + (o.purchase_to_customer_days! / arr.length), 0);
  
  const avgLateDays = lateOrders.filter(o => o.late_days !== null)
    .reduce((sum, o, _, arr) => sum + (o.late_days! / arr.length), 0);
  
  const avgEstimatedLeadTime = orders.filter(o => o.estimated_lead_time_days !== null)
    .reduce((sum, o, _, arr) => sum + (o.estimated_lead_time_days! / arr.length), 0);

  return {
    totalOrders,
    deliveredCount,
    lateCount,
    lateRate,
    avgLeadTime,
    avgLateDays,
    avgEstimatedLeadTime,
  };
}

/**
 * Calculate late rate time series
 */
export function calculateLateRateTrend(
  orders: OrderLevelMart[],
  granularity: 'week' | 'month' = 'week'
): TimeSeriesPoint[] {
  const delivered = orders.filter(o => o.order_status === 'delivered' && o.late_flag !== null);
  
  const grouped = new Map<string, { late: number; total: number }>();
  
  for (const order of delivered) {
    const key = granularity === 'week' ? order.purchase_week : order.purchase_month;
    if (!grouped.has(key)) {
      grouped.set(key, { late: 0, total: 0 });
    }
    const entry = grouped.get(key)!;
    entry.total++;
    if (order.late_flag === 1) {
      entry.late++;
    }
  }
  
  return Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data]) => ({
      date,
      value: data.total > 0 ? (data.late / data.total) * 100 : 0,
      label: `${data.late}/${data.total}`,
    }));
}

/**
 * Calculate breakdown by category
 */
export function calculateBreakdown(
  orders: OrderLevelMart[],
  dimension: 'customer_state' | 'seller_state' | 'category' | 'payment_type' | 'distance'
): BreakdownItem[] {
  const delivered = orders.filter(o => o.order_status === 'delivered' && o.late_flag !== null);
  const groups = new Map<string, { late: number; total: number }>();

  for (const order of delivered) {
    let keys: string[] = [];
    
    switch (dimension) {
      case 'customer_state':
        keys = [order.customer_state];
        break;
      case 'seller_state':
        keys = order.seller_states;
        break;
      case 'category':
        keys = order.categories_english.length > 0 ? order.categories_english : ['(tanpa kategori)'];
        break;
      case 'payment_type':
        keys = order.payment_type_mode ? [order.payment_type_mode] : ['(tidak diketahui)'];
        break;
      case 'distance':
        if (order.distance_km_mean !== null) {
          const bin = DISTANCE_BINS.find(b => order.distance_km_mean! >= b.min && order.distance_km_mean! < b.max);
          keys = [bin?.label || '>2000 km'];
        } else {
          keys = ['(geo tidak tersedia)'];
        }
        break;
    }
    
    for (const key of keys) {
      if (!groups.has(key)) {
        groups.set(key, { late: 0, total: 0 });
      }
      const entry = groups.get(key)!;
      entry.total++;
      if (order.late_flag === 1) {
        entry.late++;
      }
    }
  }

  return Array.from(groups.entries())
    .map(([category, data]) => ({
      category,
      value: data.total > 0 ? (data.late / data.total) * 100 : 0,
      count: data.total,
      percentage: data.total > 0 ? (data.late / data.total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Calculate bottleneck stage distribution
 */
export function calculateBottleneckStages(orders: OrderLevelMart[]) {
  const delivered = orders.filter(o => o.order_status === 'delivered');
  
  const stages = [
    { name: 'Pembelian → Approval', key: 'purchase_to_approved_days' as const },
    { name: 'Approval → Carrier', key: 'approved_to_carrier_days' as const },
    { name: 'Carrier → Customer', key: 'carrier_to_customer_days' as const },
  ];
  
  return stages.map(stage => {
    const values = delivered
      .map(o => o[stage.key])
      .filter((v): v is number => v !== null && v >= 0);
    
    const mean = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
    const p90 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.9)] : 0;
    
    return {
      stage: stage.name,
      mean: Math.round(mean * 10) / 10,
      median: Math.round(median * 10) / 10,
      p90: Math.round(p90 * 10) / 10,
      count: values.length,
    };
  });
}

/**
 * Calculate seller leaderboard
 */
export function calculateSellerLeaderboard(
  orders: OrderLevelMart[],
  minVolume: number = 10
): SellerLeaderboard[] {
  // Get items to seller mapping
  const sellerData = new Map<string, {
    city: string;
    state: string;
    orders: Set<string>;
    lateOrders: Set<string>;
    lateDays: number[];
    revenue: number;
  }>();
  
  const delivered = orders.filter(o => o.order_status === 'delivered');
  
  for (const order of delivered) {
    for (const sellerState of order.seller_states) {
      // We don't have full seller info per order, using state as proxy
      const key = sellerState;
      if (!sellerData.has(key)) {
        sellerData.set(key, {
          city: '',
          state: sellerState,
          orders: new Set(),
          lateOrders: new Set(),
          lateDays: [],
          revenue: 0,
        });
      }
      
      const data = sellerData.get(key)!;
      data.orders.add(order.order_id);
      data.revenue += order.total_price / order.seller_states.length; // Split revenue
      
      if (order.late_flag === 1) {
        data.lateOrders.add(order.order_id);
        if (order.late_days !== null) {
          data.lateDays.push(order.late_days);
        }
      }
    }
  }
  
  return Array.from(sellerData.entries())
    .filter(([_, data]) => data.orders.size >= minVolume)
    .map(([sellerId, data]) => ({
      seller_id: sellerId,
      seller_city: data.city,
      seller_state: data.state,
      total_orders: data.orders.size,
      late_orders: data.lateOrders.size,
      late_rate: data.orders.size > 0 ? (data.lateOrders.size / data.orders.size) * 100 : 0,
      avg_late_days: data.lateDays.length > 0 ? data.lateDays.reduce((a, b) => a + b, 0) / data.lateDays.length : 0,
      total_revenue: data.revenue,
    }))
    .sort((a, b) => b.late_rate - a.late_rate);
}

/**
 * Calculate review score distribution
 */
export function calculateReviewDistribution(orders: OrderLevelMart[]) {
  const withReviews = orders.filter(o => o.review_score !== null);
  const distribution = [1, 2, 3, 4, 5].map(score => ({
    score,
    count: withReviews.filter(o => Math.round(o.review_score!) === score).length,
    percentage: 0,
  }));
  
  const total = distribution.reduce((sum, d) => sum + d.count, 0);
  distribution.forEach(d => {
    d.percentage = total > 0 ? (d.count / total) * 100 : 0;
  });
  
  return distribution;
}

/**
 * Calculate cohort retention
 */
export function calculateCohortRetention(orders: OrderLevelMart[]): CohortData[] {
  // Group orders by customer
  const customerOrders = new Map<string, OrderLevelMart[]>();
  for (const order of orders) {
    if (!customerOrders.has(order.customer_unique_id)) {
      customerOrders.set(order.customer_unique_id, []);
    }
    customerOrders.get(order.customer_unique_id)!.push(order);
  }
  
  // Determine cohort (first purchase month) for each customer
  const customerCohorts = new Map<string, string>();
  for (const [customerId, custOrders] of customerOrders) {
    const sorted = custOrders.sort((a, b) => 
      a.order_purchase_timestamp.getTime() - b.order_purchase_timestamp.getTime()
    );
    customerCohorts.set(customerId, sorted[0].purchase_month);
  }
  
  // Calculate retention for each cohort
  const cohortData = new Map<string, { customers: Set<string>; monthlyActive: Map<number, Set<string>> }>();
  
  for (const [customerId, cohort] of customerCohorts) {
    if (!cohortData.has(cohort)) {
      cohortData.set(cohort, {
        customers: new Set(),
        monthlyActive: new Map(),
      });
    }
    
    const data = cohortData.get(cohort)!;
    data.customers.add(customerId);
    
    // Track which months this customer was active (relative to cohort)
    const orders = customerOrders.get(customerId)!;
    const cohortDate = new Date(cohort + '-01');
    
    for (const order of orders) {
      const orderDate = order.order_purchase_timestamp;
      const monthsDiff = (orderDate.getFullYear() - cohortDate.getFullYear()) * 12 +
        (orderDate.getMonth() - cohortDate.getMonth());
      
      if (monthsDiff >= 0 && monthsDiff <= 12) {
        if (!data.monthlyActive.has(monthsDiff)) {
          data.monthlyActive.set(monthsDiff, new Set());
        }
        data.monthlyActive.get(monthsDiff)!.add(customerId);
      }
    }
  }
  
  // Convert to output format
  return Array.from(cohortData.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12) // Last 12 cohorts
    .map(([cohort, data]) => {
      const retention: Record<number, number> = {};
      const totalCustomers = data.customers.size;
      
      for (let month = 0; month <= 12; month++) {
        const active = data.monthlyActive.get(month)?.size || 0;
        retention[month] = totalCustomers > 0 ? (active / totalCustomers) * 100 : 0;
      }
      
      return {
        cohort,
        retention,
        customers: totalCustomers,
      };
    });
}

/**
 * Calculate revenue metrics
 */
export function calculateRevenueMetrics(orders: OrderLevelMart[]) {
  const totalGMV = orders.reduce((sum, o) => sum + o.total_price, 0);
  const totalFreight = orders.reduce((sum, o) => sum + o.total_freight, 0);
  const totalPayments = orders.reduce((sum, o) => sum + o.payment_value_sum, 0);
  const totalItems = orders.reduce((sum, o) => sum + o.num_items, 0);
  
  const aov = orders.length > 0 ? totalGMV / orders.length : 0;
  const itemsPerOrder = orders.length > 0 ? totalItems / orders.length : 0;
  
  return {
    totalGMV,
    totalFreight,
    totalPayments,
    totalOrders: orders.length,
    totalItems,
    aov,
    itemsPerOrder,
  };
}

/**
 * Calculate revenue time series
 */
export function calculateRevenueTrend(
  orders: OrderLevelMart[],
  granularity: 'week' | 'month' = 'month'
): { orders: TimeSeriesPoint[]; revenue: TimeSeriesPoint[] } {
  const grouped = new Map<string, { count: number; revenue: number }>();
  
  for (const order of orders) {
    const key = granularity === 'week' ? order.purchase_week : order.purchase_month;
    if (!grouped.has(key)) {
      grouped.set(key, { count: 0, revenue: 0 });
    }
    const entry = grouped.get(key)!;
    entry.count++;
    entry.revenue += order.total_price;
  }
  
  const sorted = Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  
  return {
    orders: sorted.map(([date, data]) => ({ date, value: data.count })),
    revenue: sorted.map(([date, data]) => ({ date, value: data.revenue })),
  };
}

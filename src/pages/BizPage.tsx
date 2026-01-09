import { useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { CohortRetentionMatrix } from '@/components/dashboard/CohortRetentionMatrix';
import { Navigate } from 'react-router-dom';
import { filterOrders, calculateRevenueMetrics, calculateRevenueTrend, calculateCohortRetention } from '@/lib/analytics';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { CHART_COLORS } from '@/lib/constants';

export default function BizPage() {
  const { orderMart, filters } = useData();
  
  if (orderMart.length === 0) return <Navigate to="/upload" replace />;

  const filteredOrders = useMemo(() => filterOrders(orderMart, filters), [orderMart, filters]);
  const metrics = useMemo(() => calculateRevenueMetrics(filteredOrders), [filteredOrders]);
  const trends = useMemo(() => calculateRevenueTrend(filteredOrders, 'month'), [filteredOrders]);
  const cohortData = useMemo(() => calculateCohortRetention(filteredOrders), [filteredOrders]);

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

  // Calculate cumulative revenue
  const cumulativeRevenue = useMemo(() => {
    let cumulative = 0;
    return trends.revenue.map(point => {
      cumulative += point.value;
      return { ...point, cumulative };
    });
  }, [trends.revenue]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Bisnis</h1>
        <p className="text-muted-foreground mt-2">
          Metrik revenue, performa bisnis, dan cohort retention
          {filteredOrders.length !== orderMart.length && (
            <span className="ml-2 text-primary">
              ({filteredOrders.length.toLocaleString()} dari {orderMart.length.toLocaleString()} orders)
            </span>
          )}
        </p>
      </div>

      <DashboardFilters />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="kpi-card">
          <p className="kpi-label">Total GMV</p>
          <p className="kpi-value font-mono">{formatCurrency(metrics.totalGMV)}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Total Freight</p>
          <p className="kpi-value font-mono">{formatCurrency(metrics.totalFreight)}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">AOV</p>
          <p className="kpi-value font-mono">{formatCurrency(metrics.aov)}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Items/Order</p>
          <p className="kpi-value font-mono">{metrics.itemsPerOrder.toFixed(2)}</p>
        </div>
      </div>

      {/* Revenue Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardSection title="Tren Revenue Bulanan">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends.revenue}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                <Area type="monotone" dataKey="value" stroke={CHART_COLORS.primary} fill={CHART_COLORS.primary} fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </DashboardSection>

        <DashboardSection title="Tren Order Volume Bulanan">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends.orders}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Orders']} />
                <Line type="monotone" dataKey="value" stroke={CHART_COLORS.info} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </DashboardSection>
      </div>

      {/* Cohort Retention */}
      <DashboardSection 
        title="Cohort Retention Matrix" 
        subtitle="Persentase customer yang melakukan repeat purchase per bulan setelah pembelian pertama"
      >
        <CohortRetentionMatrix data={cohortData} maxMonths={6} />
      </DashboardSection>

      {/* Cumulative Revenue */}
      <DashboardSection title="Kumulatif Revenue">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumulativeRevenue}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip formatter={(v: number) => [formatCurrency(v), 'Kumulatif']} />
              <Area type="monotone" dataKey="cumulative" stroke={CHART_COLORS.success} fill={CHART_COLORS.success} fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </DashboardSection>
    </div>
  );
}

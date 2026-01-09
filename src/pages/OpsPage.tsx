import { useData } from '@/context/DataContext';
import { KPICard } from '@/components/dashboard/KPICard';
import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { BrazilMap } from '@/components/dashboard/BrazilMap';
import { Navigate } from 'react-router-dom';
import { Package, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { filterOrders, calculateOpsKPIs, calculateLateRateTrend, calculateBreakdown, calculateBottleneckStages, calculateSellerLeaderboard } from '@/lib/analytics';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { CHART_COLORS } from '@/lib/constants';
import { useMemo, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function OpsPage() {
  const { orderMart, filters } = useData();
  const [minSellerVolume, setMinSellerVolume] = useState(50);

  if (orderMart.length === 0) {
    return <Navigate to="/upload" replace />;
  }

  const filteredOrders = useMemo(() => filterOrders(orderMart, filters), [orderMart, filters]);
  const kpis = useMemo(() => calculateOpsKPIs(filteredOrders), [filteredOrders]);
  const lateRateTrend = useMemo(() => calculateLateRateTrend(filteredOrders, 'month'), [filteredOrders]);
  const stateBreakdown = useMemo(() => calculateBreakdown(filteredOrders, 'customer_state').slice(0, 10), [filteredOrders]);
  const categoryBreakdown = useMemo(() => calculateBreakdown(filteredOrders, 'category').slice(0, 10), [filteredOrders]);
  const bottleneck = useMemo(() => calculateBottleneckStages(filteredOrders), [filteredOrders]);
  const sellerLeaderboard = useMemo(() => calculateSellerLeaderboard(filteredOrders, minSellerVolume), [filteredOrders, minSellerVolume]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard Ops / Logistik</h1>
        <p className="text-muted-foreground mt-2">
          Analisis keterlambatan pengiriman dan bottleneck operasional
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
        <KPICard label="Total Orders" value={kpis.totalOrders} icon={Package} />
        <KPICard label="Delivered" value={kpis.deliveredCount} icon={Package} />
        <KPICard label="Late Rate" value={kpis.lateRate * 100} format="percent" icon={AlertTriangle} />
        <KPICard label="Avg Lead Time" value={kpis.avgLeadTime} format="days" icon={Clock} />
      </div>

      {/* Late Rate Trend */}
      <DashboardSection title="Tren Late Rate Bulanan" subtitle="Persentase keterlambatan per bulan">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lateRateTrend}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Late Rate']} />
              <Line type="monotone" dataKey="value" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </DashboardSection>

      {/* Geographic Map */}
      <DashboardSection title="Peta Distribusi Late Rate" subtitle="Visualisasi geografis per state Brazil">
        <Tabs defaultValue="late_rate">
          <TabsList className="mb-4">
            <TabsTrigger value="late_rate">Late Rate</TabsTrigger>
            <TabsTrigger value="order_count">Order Count</TabsTrigger>
            <TabsTrigger value="avg_late_days">Avg Late Days</TabsTrigger>
          </TabsList>
          <TabsContent value="late_rate">
            <BrazilMap orders={filteredOrders} metric="late_rate" />
          </TabsContent>
          <TabsContent value="order_count">
            <BrazilMap orders={filteredOrders} metric="order_count" />
          </TabsContent>
          <TabsContent value="avg_late_days">
            <BrazilMap orders={filteredOrders} metric="avg_late_days" />
          </TabsContent>
        </Tabs>
      </DashboardSection>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* State Breakdown */}
        <DashboardSection title="Late Rate by Customer State" subtitle="Top 10 state dengan late rate tertinggi">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stateBreakdown} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 12 }} width={40} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Late Rate']} />
                <Bar dataKey="value" fill={CHART_COLORS.danger} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardSection>

        {/* Category Breakdown */}
        <DashboardSection title="Late Rate by Kategori" subtitle="Top 10 kategori dengan late rate tertinggi">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryBreakdown} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} width={100} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Late Rate']} />
                <Bar dataKey="value" fill={CHART_COLORS.warning} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardSection>
      </div>

      {/* Bottleneck Stages */}
      <DashboardSection title="Bottleneck Analysis" subtitle="Rata-rata waktu per tahap pengiriman (hari)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {bottleneck.map((stage) => (
            <div key={stage.stage} className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm font-medium mb-3">{stage.stage}</p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold font-mono text-foreground">{stage.mean}</p>
                  <p className="text-xs text-muted-foreground">Mean</p>
                </div>
                <div>
                  <p className="text-2xl font-bold font-mono text-foreground">{stage.median}</p>
                  <p className="text-xs text-muted-foreground">Median</p>
                </div>
                <div>
                  <p className="text-2xl font-bold font-mono text-foreground">{stage.p90}</p>
                  <p className="text-xs text-muted-foreground">P90</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DashboardSection>

      {/* Seller Leaderboard */}
      <DashboardSection 
        title="Leaderboard Seller State" 
        subtitle="State dengan late rate tertinggi"
        action={
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">Min. volume:</span>
            <Slider 
              value={[minSellerVolume]}
              onValueChange={([v]) => setMinSellerVolume(v)}
              min={10}
              max={500}
              step={10}
              className="w-32"
            />
            <span className="font-mono w-12">{minSellerVolume}</span>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>State</th>
                <th className="text-right">Orders</th>
                <th className="text-right">Late</th>
                <th className="text-right">Late Rate</th>
                <th className="text-right">Avg Late Days</th>
                <th className="text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {sellerLeaderboard.slice(0, 15).map((seller) => (
                <tr key={seller.seller_id}>
                  <td className="font-medium">{seller.seller_state}</td>
                  <td className="text-right font-mono">{seller.total_orders.toLocaleString()}</td>
                  <td className="text-right font-mono">{seller.late_orders.toLocaleString()}</td>
                  <td className="text-right">
                    <span className={seller.late_rate > 10 ? 'badge-danger' : seller.late_rate > 5 ? 'badge-warning' : 'badge-success'}>
                      {seller.late_rate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="text-right font-mono">{seller.avg_late_days.toFixed(1)}</td>
                  <td className="text-right font-mono">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(seller.total_revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardSection>
    </div>
  );
}

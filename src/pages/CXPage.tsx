import { useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { ComplaintThemes } from '@/components/dashboard/ComplaintThemes';
import { Navigate } from 'react-router-dom';
import { filterOrders, calculateReviewDistribution, calculateBreakdown } from '@/lib/analytics';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CHART_COLORS } from '@/lib/constants';

export default function CXPage() {
  const { orderMart, filters } = useData();
  
  if (orderMart.length === 0) return <Navigate to="/upload" replace />;

  const filteredOrders = useMemo(() => filterOrders(orderMart, filters), [orderMart, filters]);
  const reviewDist = useMemo(() => calculateReviewDistribution(filteredOrders), [filteredOrders]);
  const lowReviewByCategory = useMemo(() => {
    return calculateBreakdown(filteredOrders.filter(o => o.low_review_flag !== null), 'category')
      .slice(0, 10);
  }, [filteredOrders]);
  const lowReviewByState = useMemo(() => {
    return calculateBreakdown(filteredOrders.filter(o => o.low_review_flag !== null), 'customer_state')
      .slice(0, 10);
  }, [filteredOrders]);

  const withReviews = filteredOrders.filter(o => o.review_score !== null);
  const avgScore = withReviews.length > 0 
    ? withReviews.reduce((sum, o) => sum + o.review_score!, 0) / withReviews.length 
    : 0;
  
  const withLowReviewFlag = filteredOrders.filter(o => o.low_review_flag !== null);
  const lowReviewRate = withLowReviewFlag.length > 0
    ? (filteredOrders.filter(o => o.low_review_flag === 1).length / withLowReviewFlag.length) * 100
    : 0;

  // Late vs On-time review comparison
  const lateOrders = filteredOrders.filter(o => o.late_flag === 1 && o.review_score !== null);
  const onTimeOrders = filteredOrders.filter(o => o.late_flag === 0 && o.review_score !== null);
  
  const lateAvgScore = lateOrders.length > 0
    ? lateOrders.reduce((sum, o) => sum + o.review_score!, 0) / lateOrders.length
    : 0;
  const onTimeAvgScore = onTimeOrders.length > 0
    ? onTimeOrders.reduce((sum, o) => sum + o.review_score!, 0) / onTimeOrders.length
    : 0;

  const comparisonData = [
    { name: 'On-Time', avgScore: onTimeAvgScore, count: onTimeOrders.length },
    { name: 'Late', avgScore: lateAvgScore, count: lateOrders.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard CX / Review</h1>
        <p className="text-muted-foreground mt-2">
          Analisis kepuasan pelanggan dan review
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
          <p className="kpi-label">Rata-rata Score</p>
          <p className="kpi-value font-mono">{avgScore.toFixed(2)}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Low Review Rate</p>
          <p className="kpi-value font-mono">{lowReviewRate.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground mt-1">Score ≤2</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Reviews</p>
          <p className="kpi-value font-mono">{withReviews.length.toLocaleString()}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Coverage</p>
          <p className="kpi-value font-mono">{((withReviews.length / filteredOrders.length) * 100).toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Review Distribution */}
        <DashboardSection title="Distribusi Review Score">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reviewDist}>
                <XAxis dataKey="score" />
                <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(v: number) => [v.toLocaleString(), 'Count']} 
                  labelFormatter={(label) => `Score: ${label}`}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {reviewDist.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.score <= 2 ? CHART_COLORS.danger : entry.score >= 4 ? CHART_COLORS.success : CHART_COLORS.warning} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardSection>

        {/* Late vs On-Time Comparison */}
        <DashboardSection title="Dampak Keterlambatan pada Review" subtitle="Perbandingan rata-rata score">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} layout="vertical">
                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={60} />
                <Tooltip formatter={(v: number) => [v.toFixed(2), 'Avg Score']} />
                <Bar dataKey="avgScore" radius={[0, 4, 4, 0]}>
                  {comparisonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? CHART_COLORS.success : CHART_COLORS.danger} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-center">
            <div className="p-3 bg-success/10 rounded-lg">
              <p className="text-lg font-bold font-mono text-success">{onTimeAvgScore.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">On-Time ({onTimeOrders.length.toLocaleString()})</p>
            </div>
            <div className="p-3 bg-destructive/10 rounded-lg">
              <p className="text-lg font-bold font-mono text-destructive">{lateAvgScore.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Late ({lateOrders.length.toLocaleString()})</p>
            </div>
          </div>
        </DashboardSection>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Review by Category */}
        <DashboardSection title="Low Review Rate by Kategori" subtitle="Top 10 kategori dengan low review tertinggi">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lowReviewByCategory} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} width={100} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Low Review Rate']} />
                <Bar dataKey="value" fill={CHART_COLORS.warning} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardSection>

        {/* Low Review by State */}
        <DashboardSection title="Low Review Rate by State" subtitle="Top 10 state dengan low review tertinggi">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lowReviewByState} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 12 }} width={40} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Low Review Rate']} />
                <Bar dataKey="value" fill={CHART_COLORS.info} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardSection>
      </div>

      {/* Complaint Themes NLP */}
      <ComplaintThemes orders={filteredOrders} />
    </div>
  );
}

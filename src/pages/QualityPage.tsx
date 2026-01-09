import { useData } from '@/context/DataContext';
import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { AlertCircle, CheckCircle, Database, MapPin, MessageSquare, Clock } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function QualityPage() {
  const { orderMart, dataQuality } = useData();

  if (orderMart.length === 0) {
    return <Navigate to="/upload" replace />;
  }

  if (!dataQuality) return null;

  const coverage = {
    delivered: (dataQuality.delivered_orders / dataQuality.total_orders) * 100,
    reviews: (dataQuality.orders_with_reviews / dataQuality.total_orders) * 100,
    geo: (dataQuality.orders_with_geo / dataQuality.total_orders) * 100,
  };

  // Calculate status distribution
  const statusCounts = orderMart.reduce((acc, o) => {
    acc[o.order_status] = (acc[o.order_status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Missing data summary
  const missingApproved = orderMart.filter(o => o.approved_missing).length;
  const missingCarrier = orderMart.filter(o => o.carrier_missing).length;
  const missingDelivered = orderMart.filter(o => o.delivered_missing).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Kualitas Data</h1>
        <p className="text-muted-foreground mt-2">
          Ringkasan kualitas dan kelengkapan data mart
        </p>
      </div>

      {/* Coverage Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DashboardSection title="Order Delivered" className="!p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono">{coverage.delivered.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">
                {dataQuality.delivered_orders.toLocaleString()} dari {dataQuality.total_orders.toLocaleString()}
              </p>
            </div>
          </div>
        </DashboardSection>

        <DashboardSection title="Dengan Review" className="!p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info/10 rounded-lg">
              <MessageSquare className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono">{coverage.reviews.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">
                {dataQuality.orders_with_reviews.toLocaleString()} dari {dataQuality.total_orders.toLocaleString()}
              </p>
            </div>
          </div>
        </DashboardSection>

        <DashboardSection title="Dengan Geolocation" className="!p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/10 rounded-lg">
              <MapPin className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono">{coverage.geo.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">
                {dataQuality.orders_with_geo.toLocaleString()} dari {dataQuality.total_orders.toLocaleString()}
              </p>
            </div>
          </div>
        </DashboardSection>
      </div>

      {/* Status Distribution */}
      <DashboardSection title="Distribusi Order Status" subtitle="Jumlah order per status">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(statusCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([status, count]) => (
              <div key={status} className="p-3 bg-muted/50 rounded-lg">
                <p className="text-lg font-bold font-mono">{count.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground capitalize">{status}</p>
                <p className="text-xs text-muted-foreground">
                  {((count / dataQuality.total_orders) * 100).toFixed(1)}%
                </p>
              </div>
            ))}
        </div>
      </DashboardSection>

      {/* Missing Data */}
      <DashboardSection title="Missing Values" subtitle="Kolom timestamp yang kosong">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">order_approved_at</span>
            </div>
            <div className="text-right">
              <span className="font-mono text-sm">{missingApproved.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground ml-2">
                ({((missingApproved / dataQuality.total_orders) * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">order_delivered_carrier_date</span>
            </div>
            <div className="text-right">
              <span className="font-mono text-sm">{missingCarrier.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground ml-2">
                ({((missingCarrier / dataQuality.total_orders) * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">order_delivered_customer_date</span>
            </div>
            <div className="text-right">
              <span className="font-mono text-sm">{missingDelivered.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground ml-2">
                ({((missingDelivered / dataQuality.total_orders) * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      </DashboardSection>

      {/* Anomalies */}
      {(dataQuality.negative_intervals > 0 || dataQuality.extreme_distances > 0) && (
        <DashboardSection title="Anomali Terdeteksi" subtitle="Data yang perlu diperhatikan">
          <div className="space-y-3">
            {dataQuality.negative_intervals > 0 && (
              <div className="flex items-start gap-3 p-3 bg-warning/10 rounded-lg">
                <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Interval Waktu Negatif</p>
                  <p className="text-xs text-muted-foreground">
                    {dataQuality.negative_intervals.toLocaleString()} order memiliki interval waktu negatif
                    (contoh: delivered sebelum purchase). Data ini mungkin merupakan kesalahan input.
                  </p>
                </div>
              </div>
            )}
            {dataQuality.extreme_distances > 0 && (
              <div className="flex items-start gap-3 p-3 bg-warning/10 rounded-lg">
                <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Jarak Ekstrim</p>
                  <p className="text-xs text-muted-foreground">
                    {dataQuality.extreme_distances.toLocaleString()} item memiliki jarak &gt;5000 km.
                    Data ini diexclude dari kalkulasi jarak.
                  </p>
                </div>
              </div>
            )}
          </div>
        </DashboardSection>
      )}

      {/* Missing Summary */}
      {Object.keys(dataQuality.missing_summary).length > 0 && (
        <DashboardSection title="Ringkasan Data Hilang" subtitle="Selama pembangunan mart">
          <div className="space-y-2">
            {Object.entries(dataQuality.missing_summary).map(([key, count]) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                <span className="font-mono">{count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </DashboardSection>
      )}
    </div>
  );
}

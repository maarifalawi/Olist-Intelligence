import { useState } from 'react';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { Navigate } from 'react-router-dom';
import { Download, FileCode, FileText, Loader2 } from 'lucide-react';
import { exportToCSV } from '@/lib/dataProcessing';
import { generatePDFReport } from '@/lib/pdfExport';
import { toast } from 'sonner';

export default function ExportPage() {
  const { orderMart, dataQuality } = useData();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  if (orderMart.length === 0) return <Navigate to="/upload" replace />;

  const handleExportCSV = () => {
    const csv = exportToCSV(orderMart.map(o => ({
      order_id: o.order_id,
      customer_id: o.customer_id,
      customer_state: o.customer_state,
      order_status: o.order_status,
      purchase_date: o.purchase_date,
      purchase_month: o.purchase_month,
      num_items: o.num_items,
      num_sellers: o.num_sellers,
      total_price: o.total_price,
      total_freight: o.total_freight,
      freight_ratio: o.freight_ratio,
      distance_km_mean: o.distance_km_mean,
      estimated_lead_time_days: o.estimated_lead_time_days,
      purchase_to_customer_days: o.purchase_to_customer_days,
      payment_value_sum: o.payment_value_sum,
      payment_type_mode: o.payment_type_mode,
      review_score: o.review_score,
      late_flag: o.late_flag,
      late_days: o.late_days,
      low_review_flag: o.low_review_flag,
    })));
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'order_level_mart.csv';
    a.click();
    toast.success('CSV berhasil diunduh!');
  };

  const handleDownloadPDF = async () => {
    if (!dataQuality) return;
    setIsGeneratingPDF(true);
    try {
      await generatePDFReport({ orderMart, dataQuality });
      toast.success('PDF Ringkasan Eksekutif berhasil diunduh!');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Gagal membuat PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleDownloadMLGuide = async () => {
    try {
      const response = await fetch('/python_ml_guide.py');
      if (!response.ok) throw new Error('File not found');
      const content = await response.text();
      const blob = new Blob([content], { type: 'text/x-python' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'python_ml_guide.py';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Python ML Guide berhasil diunduh!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Gagal mengunduh file. Pastikan file tersedia.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ekspor Data & Laporan</h1>
        <p className="text-muted-foreground mt-2">Download data mart, laporan PDF, dan panduan Python untuk ML</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DashboardSection title="Order Level Mart" subtitle={`${orderMart.length.toLocaleString()} baris`}>
          <p className="text-sm text-muted-foreground mb-4">
            Data mart lengkap dengan semua fitur untuk analisis dan ML training.
          </p>
          <Button onClick={handleExportCSV} className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Download CSV
          </Button>
        </DashboardSection>

        <DashboardSection title="Ringkasan Eksekutif" subtitle="Laporan PDF">
          <p className="text-sm text-muted-foreground mb-4">
            Laporan PDF dengan KPI, bottleneck, dan rekomendasi tindakan.
          </p>
          <Button onClick={handleDownloadPDF} disabled={isGeneratingPDF} className="w-full">
            {isGeneratingPDF ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            {isGeneratingPDF ? 'Generating...' : 'Download PDF'}
          </Button>
        </DashboardSection>

        <DashboardSection title="Panduan Python ML" subtitle="Training eksternal">
          <p className="text-sm text-muted-foreground mb-4">
            Kode Python lengkap untuk training Model A & B dengan anti-leakage.
          </p>
          <Button onClick={handleDownloadMLGuide} variant="outline" className="w-full">
            <FileCode className="w-4 h-4 mr-2" />
            Download Python Guide
          </Button>
        </DashboardSection>
      </div>

      <DashboardSection title="Ringkasan Data">
        <div className="prose prose-sm max-w-none">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold font-mono">{dataQuality?.total_orders.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Orders</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold font-mono">{dataQuality?.delivered_orders.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Delivered</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold font-mono">
                {((dataQuality?.orders_with_reviews || 0) / (dataQuality?.total_orders || 1) * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">Coverage Review</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold font-mono">
                {((dataQuality?.orders_with_geo || 0) / (dataQuality?.total_orders || 1) * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">Coverage Geo</p>
            </div>
          </div>

          <h3 className="text-base font-semibold mb-2">Catatan Penting untuk ML Training:</h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>
              <strong>Anti Data Leakage:</strong> Model A hanya boleh menggunakan fitur yang diketahui 
              SEBELUM pengiriman (tidak boleh pakai delivered dates, review, dsb).
            </li>
            <li>
              <strong>Time-Based Split:</strong> Gunakan 80% data awal untuk training, 20% akhir untuk testing 
              berdasarkan order_purchase_timestamp.
            </li>
            <li>
              <strong>Model B Cascading:</strong> Model B (Low Review) bisa menggunakan output prediksi 
              Model A (risk_late_score) sebagai fitur tambahan.
            </li>
            <li>
              <strong>Keterbatasan:</strong> Geolocation berbasis ZIP prefix (akurasi terbatas), 
              review text banyak kosong (NLP terbatas).
            </li>
          </ul>
        </div>
      </DashboardSection>

      <DashboardSection title="Struktur ML Pipeline (Python)">
        <div className="font-mono text-xs bg-muted/30 p-4 rounded-lg overflow-x-auto">
          <pre>{`olist_ml/
├── data/                    # 9 CSV Olist
├── models/                  # Output .joblib
├── src/
│   ├── config.py           # Konstanta & forbidden cols
│   ├── data_loader.py      # Load & build mart
│   ├── feature_engineering.py  # Fitur & leakage guard
│   ├── model_training.py   # Train & save
│   ├── evaluation.py       # Metrik & SHAP
│   └── inference.py        # Prediksi
└── main.py                 # Entry point

Jalankan: python main.py train`}</pre>
        </div>
      </DashboardSection>
    </div>
  );
}

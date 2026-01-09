// generate laporan PDF buat ringkasan eksekutif
// pake jsPDF - simple tapi powerful

import jsPDF from 'jspdf';
import { OrderLevelMart, DataQualityReport } from './types';
import { calculateOpsKPIs, calculateRevenueMetrics, calculateBreakdown, calculateBottleneckStages } from './analytics';

interface ExecutiveSummary {
  orderMart: OrderLevelMart[];
  dataQuality: DataQualityReport;
}

// fungsi utama generate PDF
export async function generatePDFReport({ orderMart, dataQuality }: ExecutiveSummary): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;
  
  // hitung semua metrik dulu
  const opsKPIs = calculateOpsKPIs(orderMart);
  const revenueMetrics = calculateRevenueMetrics(orderMart);
  const stateBreakdown = calculateBreakdown(orderMart, 'customer_state').slice(0, 5);
  const bottlenecks = calculateBottleneckStages(orderMart);
  
  // helper buat nambahin text
  const addText = (text: string, size: number = 10, style: 'normal' | 'bold' = 'normal') => {
    pdf.setFontSize(size);
    pdf.setFont('helvetica', style);
    const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin);
    pdf.text(lines, margin, yPos);
    yPos += lines.length * (size * 0.4) + 2;
  };
  
  // helper buat garis pemisah
  const addLine = () => {
    pdf.setDrawColor(200);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;
  };
  
  // cek kalo perlu pindah halaman
  const checkNewPage = (requiredSpace: number = 30) => {
    if (yPos > pdf.internal.pageSize.getHeight() - requiredSpace) {
      pdf.addPage();
      yPos = 20;
    }
  };

  // header laporan
  pdf.setTextColor(30, 30, 30);
  addText('OLIST INTELLIGENCE SUITE', 20, 'bold');
  addText('Ringkasan Eksekutif', 14, 'normal');
  addText(`Tanggal: ${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}`, 10);
  yPos += 5;
  addLine();

  // section 1: overview data
  addText('1. IKHTISAR DATA', 14, 'bold');
  yPos += 2;
  
  const overviewData = [
    ['Total Orders', dataQuality.total_orders.toLocaleString()],
    ['Orders Delivered', dataQuality.delivered_orders.toLocaleString()],
    ['Coverage Review', `${((dataQuality.orders_with_reviews / dataQuality.total_orders) * 100).toFixed(1)}%`],
    ['Coverage Geolokasi', `${((dataQuality.orders_with_geo / dataQuality.total_orders) * 100).toFixed(1)}%`],
  ];
  
  overviewData.forEach(([label, value]) => {
    pdf.setFont('helvetica', 'normal');
    pdf.text(`• ${label}:`, margin, yPos);
    pdf.setFont('helvetica', 'bold');
    pdf.text(value, margin + 60, yPos);
    yPos += 5;
  });
  yPos += 5;

  // section 2: ops KPIs
  checkNewPage();
  addText('2. PERFORMA OPERASIONAL (OPS)', 14, 'bold');
  yPos += 2;
  
  const opsData = [
    ['Late Delivery Rate', `${(opsKPIs.lateRate * 100).toFixed(2)}%`],
    ['Rata-rata Lead Time', `${opsKPIs.avgLeadTime.toFixed(1)} hari`],
    ['Rata-rata Hari Keterlambatan', `${opsKPIs.avgLateDays.toFixed(1)} hari`],
    ['Total Order Terlambat', opsKPIs.lateCount.toLocaleString()],
  ];
  
  opsData.forEach(([label, value]) => {
    pdf.setFont('helvetica', 'normal');
    pdf.text(`• ${label}:`, margin, yPos);
    pdf.setFont('helvetica', 'bold');
    pdf.text(value, margin + 70, yPos);
    yPos += 5;
  });
  yPos += 5;

  // section 3: revenue bisnis
  checkNewPage();
  addText('3. PERFORMA BISNIS', 14, 'bold');
  yPos += 2;
  
  const bizData = [
    ['Total GMV', `R$ ${revenueMetrics.totalGMV.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`],
    ['Total Freight', `R$ ${revenueMetrics.totalFreight.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`],
    ['Average Order Value', `R$ ${revenueMetrics.aov.toFixed(2)}`],
    ['Items per Order', revenueMetrics.itemsPerOrder.toFixed(2)],
  ];
  
  bizData.forEach(([label, value]) => {
    pdf.setFont('helvetica', 'normal');
    pdf.text(`• ${label}:`, margin, yPos);
    pdf.setFont('helvetica', 'bold');
    pdf.text(value, margin + 60, yPos);
    yPos += 5;
  });
  yPos += 5;

  // section 4: top state late rate
  checkNewPage();
  addText('4. TOP 5 STATE DENGAN LATE RATE TERTINGGI', 14, 'bold');
  yPos += 2;
  
  stateBreakdown.forEach((item, index) => {
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${index + 1}. ${item.category}:`, margin, yPos);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${item.value.toFixed(2)}% (${item.count} orders)`, margin + 40, yPos);
    yPos += 5;
  });
  yPos += 5;

  // section 5: bottleneck analysis
  checkNewPage();
  addText('5. ANALISIS BOTTLENECK (HARI)', 14, 'bold');
  yPos += 2;
  
  // header tabel
  pdf.setFont('helvetica', 'bold');
  pdf.text('Stage', margin, yPos);
  pdf.text('Mean', margin + 70, yPos);
  pdf.text('Median', margin + 95, yPos);
  pdf.text('P90', margin + 120, yPos);
  yPos += 5;
  addLine();
  
  bottlenecks.forEach((stage) => {
    pdf.setFont('helvetica', 'normal');
    pdf.text(stage.stage, margin, yPos);
    pdf.text(stage.mean.toFixed(1), margin + 70, yPos);
    pdf.text(stage.median.toFixed(1), margin + 95, yPos);
    pdf.text(stage.p90.toFixed(1), margin + 120, yPos);
    yPos += 5;
  });
  yPos += 5;

  // section 6: rekomendasi
  checkNewPage(50);
  addText('6. REKOMENDASI TINDAKAN', 14, 'bold');
  yPos += 2;
  
  const recommendations = [
    'Prioritaskan pengiriman untuk state dengan late rate tinggi',
    'Optimalkan proses carrier handover (bottleneck terbesar)',
    'Monitor seller dengan performa rendah secara berkala',
    'Gunakan Model ML untuk prediksi risiko keterlambatan',
    'Implementasi proactive customer messaging untuk order berisiko tinggi',
  ];
  
  recommendations.forEach((rec) => {
    addText(`• ${rec}`, 10);
  });
  yPos += 5;

  // section 7: keterbatasan
  checkNewPage(40);
  addText('7. KETERBATASAN DATA', 14, 'bold');
  yPos += 2;
  
  const limitations = [
    `Anomali terdeteksi: ${dataQuality.negative_intervals} interval negatif, ${dataQuality.extreme_distances} jarak ekstrim`,
    'Geolokasi berbasis ZIP prefix (akurasi terbatas)',
    'Review text banyak kosong (NLP terbatas)',
    'Data bersifat historical, perlu validasi untuk kondisi terkini',
  ];
  
  limitations.forEach((lim) => {
    addText(`• ${lim}`, 10);
  });

  // footer
  pdf.setFontSize(8);
  pdf.setTextColor(128);
  pdf.text(
    'Generated by Olist Intelligence Suite',
    pageWidth / 2,
    pdf.internal.pageSize.getHeight() - 10,
    { align: 'center' }
  );

  // simpen PDF-nya
  pdf.save('olist_executive_summary.pdf');
}

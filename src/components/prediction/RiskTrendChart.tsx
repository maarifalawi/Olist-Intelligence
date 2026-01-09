import { useMemo, useRef, useState } from 'react';
import { TrendingUp, Calendar, AlertTriangle, Download, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  Area,
  AreaChart,
  ComposedChart,
} from 'recharts';
import { useData } from '@/context/DataContext';
import { batchPredict, type PredictionResult } from '@/lib/tfPrediction';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface MonthlyTrend {
  month: string;
  monthNum: number;
  year: number;
  avgRisk: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  totalOrders: number;
  avgDistance: number;
  avgLeadTime: number;
}

interface DayOfWeekTrend {
  day: string;
  dayNum: number;
  avgRisk: number;
  orderCount: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function RiskTrendChart() {
  const { orderMart } = useData();
  const [predictions, setPredictions] = useState<Map<string, PredictionResult>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculated, setIsCalculated] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const chartsRef = useRef<HTMLDivElement>(null);

  const calculateTrends = async () => {
    if (!orderMart || orderMart.length === 0) return;
    
    setIsLoading(true);
    try {
      const ordersToAnalyze = orderMart.slice(0, 500);
      const results = await batchPredict(ordersToAnalyze);
      setPredictions(results);
      setIsCalculated(true);
    } catch (error) {
      console.error('Error calculating trends:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToPDF = async () => {
    if (!chartsRef.current) return;
    
    setIsExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      
      // Title
      pdf.setFontSize(18);
      pdf.text('Laporan Tren Risiko Keterlambatan', pageWidth / 2, 20, { align: 'center' });
      pdf.setFontSize(10);
      pdf.text(`Dihasilkan: ${new Date().toLocaleDateString('id-ID')}`, pageWidth / 2, 28, { align: 'center' });
      
      // Capture charts
      const canvas = await html2canvas(chartsRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 10, 35, imgWidth, Math.min(imgHeight, 240));
      
      // Summary stats on new page if needed
      if (imgHeight > 200) {
        pdf.addPage();
      }
      
      const summaryY = imgHeight > 200 ? 20 : imgHeight + 45;
      pdf.setFontSize(12);
      pdf.text('Ringkasan Statistik:', 10, summaryY);
      pdf.setFontSize(10);
      
      const stats = [
        `Total Order Dianalisis: ${predictions.size}`,
        `Periode Data: ${monthlyTrends.length > 0 ? `${monthlyTrends[0]?.month} - ${monthlyTrends[monthlyTrends.length - 1]?.month}` : '-'}`,
        `Rata-rata Risiko: ${(monthlyTrends.reduce((a, b) => a + b.avgRisk, 0) / (monthlyTrends.length || 1) * 100).toFixed(1)}%`,
        `Bulan Risiko Tertinggi: ${monthlyTrends.length > 0 ? monthlyTrends.reduce((a, b) => a.avgRisk > b.avgRisk ? a : b).month : '-'}`,
      ];
      
      stats.forEach((stat, i) => {
        pdf.text(`• ${stat}`, 15, summaryY + 8 + (i * 6));
      });
      
      pdf.save(`risk_trend_report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const monthlyTrends = useMemo((): MonthlyTrend[] => {
    if (!orderMart || predictions.size === 0) return [];

    const monthlyData: Record<string, {
      risks: number[];
      highRisk: number;
      mediumRisk: number;
      lowRisk: number;
      distances: number[];
      leadTimes: number[];
      year: number;
      monthNum: number;
    }> = {};

    orderMart.slice(0, 500).forEach(order => {
      const prediction = predictions.get(order.order_id);
      if (!prediction) return;

      const date = order.order_purchase_timestamp;
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;

      if (!monthlyData[key]) {
        monthlyData[key] = {
          risks: [],
          highRisk: 0,
          mediumRisk: 0,
          lowRisk: 0,
          distances: [],
          leadTimes: [],
          year,
          monthNum: month,
        };
      }

      monthlyData[key].risks.push(prediction.risk_score);
      monthlyData[key].distances.push(order.distance_km_mean || 0);
      monthlyData[key].leadTimes.push(order.estimated_lead_time_days || 0);

      if (prediction.risk_bucket === 'Sangat Tinggi' || prediction.risk_bucket === 'Tinggi') {
        monthlyData[key].highRisk++;
      } else if (prediction.risk_bucket === 'Sedang') {
        monthlyData[key].mediumRisk++;
      } else {
        monthlyData[key].lowRisk++;
      }
    });

    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, data]) => ({
        month: `${MONTH_NAMES[data.monthNum]} ${data.year}`,
        monthNum: data.monthNum,
        year: data.year,
        avgRisk: data.risks.reduce((a, b) => a + b, 0) / data.risks.length,
        highRiskCount: data.highRisk,
        mediumRiskCount: data.mediumRisk,
        lowRiskCount: data.lowRisk,
        totalOrders: data.risks.length,
        avgDistance: data.distances.reduce((a, b) => a + b, 0) / data.distances.length,
        avgLeadTime: data.leadTimes.reduce((a, b) => a + b, 0) / data.leadTimes.length,
      }));
  }, [orderMart, predictions]);

  const dayOfWeekTrends = useMemo((): DayOfWeekTrend[] => {
    if (!orderMart || predictions.size === 0) return [];

    const dayData: Record<number, { risks: number[]; count: number }> = {};

    orderMart.slice(0, 500).forEach(order => {
      const prediction = predictions.get(order.order_id);
      if (!prediction) return;

      const dayOfWeek = order.purchase_dayofweek;
      if (!dayData[dayOfWeek]) {
        dayData[dayOfWeek] = { risks: [], count: 0 };
      }
      dayData[dayOfWeek].risks.push(prediction.risk_score);
      dayData[dayOfWeek].count++;
    });

    return Object.entries(dayData)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([dayNum, data]) => ({
        day: DAY_NAMES[Number(dayNum)] || `Day ${dayNum}`,
        dayNum: Number(dayNum),
        avgRisk: data.risks.reduce((a, b) => a + b, 0) / data.risks.length,
        orderCount: data.count,
      }));
  }, [orderMart, predictions]);

  const chartConfig = {
    avgRisk: {
      label: "Rata-rata Risiko",
      color: "hsl(var(--destructive))",
    },
    highRiskCount: {
      label: "Risiko Tinggi",
      color: "hsl(0, 84%, 60%)",
    },
    mediumRiskCount: {
      label: "Risiko Sedang",
      color: "hsl(45, 93%, 47%)",
    },
    lowRiskCount: {
      label: "Risiko Rendah",
      color: "hsl(142, 76%, 36%)",
    },
  };

  if (!orderMart || orderMart.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Upload data order untuk melihat grafik tren risiko</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isCalculated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Grafik Tren Risiko
          </CardTitle>
          <CardDescription>
            Analisis tren prediksi risiko berdasarkan waktu pembelian
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              Klik tombol di bawah untuk menghitung tren risiko dari {Math.min(orderMart.length, 500)} order
            </p>
            <Button onClick={calculateTrends} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menghitung...
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Hitung Tren Risiko
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Export Button */}
      <div className="flex justify-end">
        <Button onClick={exportToPDF} disabled={isExporting} variant="outline">
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Mengekspor...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Export ke PDF
            </>
          )}
        </Button>
      </div>

      {/* Charts Container for PDF export */}
      <div ref={chartsRef} className="space-y-6 bg-background">
        {/* Monthly Risk Trend Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Tren Risiko Bulanan
            </CardTitle>
            <CardDescription>
              Rata-rata skor risiko keterlambatan per bulan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <AreaChart data={monthlyTrends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                  domain={[0, 1]}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => {
                        if (name === 'avgRisk') {
                          return [`${((value as number) * 100).toFixed(1)}%`, 'Avg Risk'];
                        }
                        return [value, name];
                      }}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="avgRisk"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  fill="url(#riskGradient)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Risk Distribution by Month */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Distribusi Risiko per Bulan
            </CardTitle>
            <CardDescription>
              Jumlah order berdasarkan kategori risiko
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={monthlyTrends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="highRiskCount" name="Tinggi" stackId="a" fill="hsl(0, 84%, 60%)" />
                <Bar dataKey="mediumRiskCount" name="Sedang" stackId="a" fill="hsl(45, 93%, 47%)" />
                <Bar dataKey="lowRiskCount" name="Rendah" stackId="a" fill="hsl(142, 76%, 36%)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Day of Week Risk Pattern */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Pola Risiko per Hari
            </CardTitle>
            <CardDescription>
              Rata-rata risiko berdasarkan hari pembelian
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <ComposedChart data={dayOfWeekTrends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  yAxisId="left"
                  tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                  domain={[0, 1]}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => {
                        if (name === 'avgRisk') {
                          return [`${((value as number) * 100).toFixed(1)}%`, 'Avg Risk'];
                        }
                        return [value, name];
                      }}
                    />
                  }
                />
                <Bar 
                  yAxisId="right"
                  dataKey="orderCount" 
                  name="Jumlah Order"
                  fill="hsl(var(--muted-foreground))" 
                  opacity={0.3}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="avgRisk"
                  name="Avg Risk"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--destructive))', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {monthlyTrends.length > 0 
                    ? `${(Math.max(...monthlyTrends.map(t => t.avgRisk)) * 100).toFixed(1)}%`
                    : '-'
                  }
                </p>
                <p className="text-xs text-muted-foreground">Risiko Tertinggi (Bulan)</p>
                <Badge variant="destructive" className="mt-1">
                  {monthlyTrends.length > 0 
                    ? monthlyTrends.find(t => t.avgRisk === Math.max(...monthlyTrends.map(x => x.avgRisk)))?.month
                    : '-'
                  }
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {dayOfWeekTrends.length > 0 
                    ? `${(Math.max(...dayOfWeekTrends.map(t => t.avgRisk)) * 100).toFixed(1)}%`
                    : '-'
                  }
                </p>
                <p className="text-xs text-muted-foreground">Risiko Tertinggi (Hari)</p>
                <Badge variant="secondary" className="mt-1">
                  {dayOfWeekTrends.length > 0 
                    ? dayOfWeekTrends.find(t => t.avgRisk === Math.max(...dayOfWeekTrends.map(x => x.avgRisk)))?.day
                    : '-'
                  }
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {predictions.size}
                </p>
                <p className="text-xs text-muted-foreground">Order Dianalisis</p>
                <Badge variant="outline" className="mt-1">
                  dari {orderMart.length} total
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

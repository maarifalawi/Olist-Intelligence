import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, TrendingUp, CheckCircle, Loader2, Zap, Info, RefreshCw, Download, BarChart3, History, Target, Users, Sliders, LineChart, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { WhatIfSimulator } from './WhatIfSimulator';
import { RiskTrendChart } from './RiskTrendChart';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAlerts } from '@/context/AlertContext';
import {
  loadModel,
  predictRisk,
  createDefaultInput,
  getModelStatus,
  batchPredict,
  BRAZILIAN_STATES,
  TOP_CATEGORIES,
  PAYMENT_TYPES,
  type PredictionInput,
  type PredictionResult,
} from '@/lib/tfPrediction';
import { useData } from '@/context/DataContext';

interface PredictionHistoryItem {
  id: string;
  timestamp: Date;
  input: PredictionInput;
  result: PredictionResult;
  orderId?: string;
}

interface BatchPredictionSummary {
  total: number;
  sangattinggi: number;
  tinggi: number;
  sedang: number;
  rendah: number;
  avgRiskScore: number;
  predictions: Array<{ orderId: string; result: PredictionResult }>;
}

export function LateRiskPredictor() {
  const { orderMart } = useData();
  const { addAlert, addBatchAlerts, settings } = useAlerts();
  const [input, setInput] = useState<PredictionInput>(createDefaultInput());
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState(getModelStatus());
  const [activeTab, setActiveTab] = useState('manual');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [predictionHistory, setPredictionHistory] = useState<PredictionHistoryItem[]>([]);
  const [batchResult, setBatchResult] = useState<BatchPredictionSummary | null>(null);
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [batchSize, setBatchSize] = useState<string>('50');
  const [alertsTriggered, setAlertsTriggered] = useState<number>(0);

  useEffect(() => {
    const initModel = async () => {
      await loadModel();
      setModelStatus(getModelStatus());
    };
    initModel();
  }, []);

  // Calculate model accuracy if we have actual late_flag data
  const modelAccuracy = useMemo(() => {
    if (!orderMart || orderMart.length === 0 || !batchResult) return null;

    let correct = 0;
    let total = 0;

    for (const pred of batchResult.predictions) {
      const order = orderMart.find(o => o.order_id === pred.orderId);
      if (order && order.late_flag !== null) {
        const predictedLate = pred.result.risk_score >= 0.5;
        const actualLate = order.late_flag === 1;
        if (predictedLate === actualLate) correct++;
        total++;
      }
    }

    if (total === 0) return null;
    return {
      accuracy: (correct / total) * 100,
      total,
      correct,
    };
  }, [orderMart, batchResult]);

  const handleInputChange = (field: keyof PredictionInput, value: string | number) => {
    setInput(prev => ({ ...prev, [field]: value }));
  };

  const handlePredict = async () => {
    setIsLoading(true);
    try {
      const prediction = await predictRisk(input);
      setResult(prediction);

      // Trigger alert for single prediction if high risk
      if (selectedOrderId) {
        addAlert(selectedOrderId, prediction);
      }

      // Add to history
      const historyItem: PredictionHistoryItem = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        input: { ...input },
        result: prediction,
        orderId: selectedOrderId || undefined,
      };
      setPredictionHistory(prev => [historyItem, ...prev].slice(0, 20));
    } catch (error) {
      console.error('Prediction error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBatchPredict = async () => {
    if (!orderMart || orderMart.length === 0) return;

    setIsBatchLoading(true);
    try {
      const size = parseInt(batchSize) || 50;
      const ordersToPredict = orderMart.slice(0, size);
      const results = await batchPredict(ordersToPredict);

      // Summarize results
      const predictions: Array<{ orderId: string; result: PredictionResult }> = [];
      let sangattinggi = 0, tinggi = 0, sedang = 0, rendah = 0;
      let totalRisk = 0;

      results.forEach((result, orderId) => {
        predictions.push({ orderId, result });
        totalRisk += result.risk_score;
        switch (result.risk_bucket) {
          case 'Sangat Tinggi': sangattinggi++; break;
          case 'Tinggi': tinggi++; break;
          case 'Sedang': sedang++; break;
          case 'Rendah': rendah++; break;
        }
      });

      setBatchResult({
        total: predictions.length,
        sangattinggi,
        tinggi,
        sedang,
        rendah,
        avgRiskScore: totalRisk / predictions.length,
        predictions: predictions.sort((a, b) => b.result.risk_score - a.result.risk_score),
      });

      // Trigger alerts for high-risk predictions
      const alertCount = addBatchAlerts(predictions);
      setAlertsTriggered(alertCount);
    } catch (error) {
      console.error('Batch prediction error:', error);
    } finally {
      setIsBatchLoading(false);
    }
  };

  const handleReset = () => {
    setInput(createDefaultInput());
    setResult(null);
    setSelectedOrderId('');
  };

  const handleOrderSelect = (orderId: string) => {
    setSelectedOrderId(orderId);
    const order = orderMart?.find(o => o.order_id === orderId);
    if (order) {
      setInput({
        num_items: order.num_items,
        num_sellers: order.num_sellers,
        num_categories: order.num_categories,
        total_price: order.total_price,
        total_freight: order.total_freight,
        weight_g_mean: order.weight_g_mean ?? 1000,
        volume_cm3_mean: order.volume_cm3_mean ?? 5000,
        distance_km_mean: order.distance_km_mean ?? 300,
        estimated_lead_time_days: order.estimated_lead_time_days ?? 20,
        shipping_limit_offset_days_mean: order.shipping_limit_offset_days_mean ?? 5,
        purchase_to_approved_days: order.purchase_to_approved_days ?? 0.5,
        payment_value_sum: order.payment_value_sum,
        payment_installments_mean: order.payment_installments_mean,
        purchase_dayofweek: order.purchase_dayofweek,
        purchase_month_num: order.order_purchase_timestamp.getMonth() + 1,
        customer_state: order.customer_state,
        seller_state_mode: order.seller_states[0] ?? 'SP',
        category_mode: order.categories_english[0] ?? 'other',
        payment_type_mode: order.payment_type_mode ?? 'credit_card',
      });
    }
  };

  const handleHistorySelect = (item: PredictionHistoryItem) => {
    setInput(item.input);
    setResult(item.result);
    setSelectedOrderId(item.orderId || '');
  };

  const exportBatchToCSV = () => {
    if (!batchResult) return;

    const rows: string[][] = [
      ['Order ID', 'Risk Score (%)', 'Risk Bucket', 'Confidence', 'Top Risk Factor', 'Actual Late (jika ada)']
    ];

    batchResult.predictions.forEach(({ orderId, result }) => {
      const order = orderMart?.find(o => o.order_id === orderId);
      const actualLate = order?.late_flag !== null ? (order.late_flag === 1 ? 'Ya' : 'Tidak') : 'N/A';

      rows.push([
        orderId,
        (result.risk_score * 100).toFixed(1),
        result.risk_bucket,
        result.confidence,
        result.top_risk_factors[0]?.feature || '-',
        actualLate,
      ]);
    });

    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batch_predictions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getRiskColor = (bucket: PredictionResult['risk_bucket']) => {
    switch (bucket) {
      case 'Sangat Tinggi': return 'bg-red-500 text-white';
      case 'Tinggi': return 'bg-orange-500 text-white';
      case 'Sedang': return 'bg-yellow-500 text-black';
      case 'Rendah': return 'bg-green-500 text-white';
    }
  };

  const getRiskBadgeVariant = (bucket: PredictionResult['risk_bucket']) => {
    switch (bucket) {
      case 'Sangat Tinggi': return 'destructive';
      case 'Tinggi': return 'destructive';
      case 'Sedang': return 'secondary';
      case 'Rendah': return 'default';
    }
  };

  const getRiskIcon = (bucket: PredictionResult['risk_bucket']) => {
    switch (bucket) {
      case 'Sangat Tinggi':
      case 'Tinggi':
        return <AlertTriangle className="h-6 w-6" />;
      case 'Sedang':
        return <TrendingUp className="h-6 w-6" />;
      case 'Rendah':
        return <CheckCircle className="h-6 w-6" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Model Status */}
      <Alert>
        <Zap className="h-4 w-4" />
        <AlertTitle>TensorFlow.js Prediction Engine</AlertTitle>
        <AlertDescription>
          {modelStatus.loaded ? (
            <span className="text-green-600">Model siap digunakan (mode demo/heuristik)</span>
          ) : modelStatus.loading ? (
            <span className="text-yellow-600">Loading model...</span>
          ) : (
            <span className="text-muted-foreground">Model belum dimuat</span>
          )}
          <span className="text-muted-foreground ml-2">
            • Untuk produksi, export model dari Python menggunakan tensorflowjs
          </span>
        </AlertDescription>
      </Alert>

      {/* Main Tabs */}
      <Tabs defaultValue="single" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="single" className="gap-2">
            <Target className="w-4 h-4" />
            <span className="hidden sm:inline">Prediksi</span>
          </TabsTrigger>
          <TabsTrigger value="batch" className="gap-2" disabled={!orderMart?.length}>
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Batch</span>
          </TabsTrigger>
          <TabsTrigger value="whatif" className="gap-2">
            <Sliders className="w-4 h-4" />
            <span className="hidden sm:inline">What-If</span>
          </TabsTrigger>
          <TabsTrigger value="trends" className="gap-2" disabled={!orderMart?.length}>
            <LineChart className="w-4 h-4" />
            <span className="hidden sm:inline">Tren</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Histori</span>
          </TabsTrigger>
        </TabsList>

        {/* Single Prediction Tab */}
        <TabsContent value="single">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Input Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Input Data Order
                </CardTitle>
                <CardDescription>
                  Masukkan fitur order untuk prediksi risiko keterlambatan
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="manual">Input Manual</TabsTrigger>
                    <TabsTrigger value="fromdata" disabled={!orderMart?.length}>
                      Dari Data
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="fromdata" className="space-y-4">
                    {orderMart && orderMart.length > 0 && (
                      <div className="space-y-2">
                        <Label>Pilih Order ID</Label>
                        <Select value={selectedOrderId} onValueChange={handleOrderSelect}>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih order..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
                            {orderMart.slice(0, 100).map(order => (
                              <SelectItem key={order.order_id} value={order.order_id}>
                                {order.order_id.slice(0, 12)}... - {order.customer_state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Menampilkan 100 order pertama
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="manual" className="space-y-4">
                    <div className="text-xs text-muted-foreground mb-2">
                      Mode input manual untuk testing
                    </div>
                  </TabsContent>
                </Tabs>

                <Separator className="my-4" />

                {/* Feature inputs */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="num_items">Jumlah Item</Label>
                    <Input
                      id="num_items"
                      type="number"
                      min={1}
                      value={input.num_items}
                      onChange={e => handleInputChange('num_items', parseInt(e.target.value) || 1)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="num_sellers">Jumlah Seller</Label>
                    <Input
                      id="num_sellers"
                      type="number"
                      min={1}
                      value={input.num_sellers}
                      onChange={e => handleInputChange('num_sellers', parseInt(e.target.value) || 1)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="total_price">Total Harga (BRL)</Label>
                    <Input
                      id="total_price"
                      type="number"
                      min={0}
                      step={10}
                      value={input.total_price}
                      onChange={e => handleInputChange('total_price', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="total_freight">Total Freight (BRL)</Label>
                    <Input
                      id="total_freight"
                      type="number"
                      min={0}
                      step={5}
                      value={input.total_freight}
                      onChange={e => handleInputChange('total_freight', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="distance_km_mean">Jarak (km)</Label>
                    <Input
                      id="distance_km_mean"
                      type="number"
                      min={0}
                      step={50}
                      value={input.distance_km_mean}
                      onChange={e => handleInputChange('distance_km_mean', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estimated_lead_time_days">Est. Lead Time (hari)</Label>
                    <Input
                      id="estimated_lead_time_days"
                      type="number"
                      min={1}
                      value={input.estimated_lead_time_days}
                      onChange={e => handleInputChange('estimated_lead_time_days', parseFloat(e.target.value) || 1)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weight_g_mean">Berat Rata-rata (g)</Label>
                    <Input
                      id="weight_g_mean"
                      type="number"
                      min={0}
                      step={100}
                      value={input.weight_g_mean}
                      onChange={e => handleInputChange('weight_g_mean', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="volume_cm3_mean">Volume Rata-rata (cm³)</Label>
                    <Input
                      id="volume_cm3_mean"
                      type="number"
                      min={0}
                      step={1000}
                      value={input.volume_cm3_mean}
                      onChange={e => handleInputChange('volume_cm3_mean', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>State Customer</Label>
                    <Select
                      value={input.customer_state}
                      onValueChange={v => handleInputChange('customer_state', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BRAZILIAN_STATES.map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>State Seller</Label>
                    <Select
                      value={input.seller_state_mode}
                      onValueChange={v => handleInputChange('seller_state_mode', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BRAZILIAN_STATES.map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Kategori Produk</Label>
                    <Select
                      value={input.category_mode}
                      onValueChange={v => handleInputChange('category_mode', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TOP_CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>
                            {cat.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipe Pembayaran</Label>
                    <Select
                      value={input.payment_type_mode}
                      onValueChange={v => handleInputChange('payment_type_mode', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_TYPES.map(type => (
                          <SelectItem key={type} value={type}>
                            {type.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <Button onClick={handlePredict} disabled={isLoading} className="flex-1">
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Predicting...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Prediksi Risiko
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            <div className="space-y-4">
              {result ? (
                <>
                  {/* Risk Score Card */}
                  <Card className={`${getRiskColor(result.risk_bucket)} border-0`}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm opacity-80">Risk Score</p>
                          <p className="text-4xl font-bold">
                            {(result.risk_score * 100).toFixed(1)}%
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {getRiskIcon(result.risk_bucket)}
                          <Badge variant="secondary" className="bg-white/20">
                            {result.risk_bucket}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-white/60 transition-all duration-500"
                            style={{ width: `${result.risk_score * 100}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-xs mt-2 opacity-70">
                        Confidence: {result.confidence}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Actual vs Predicted (if order selected) */}
                  {selectedOrderId && orderMart && (
                    (() => {
                      const order = orderMart.find(o => o.order_id === selectedOrderId);
                      if (order && order.late_flag !== null) {
                        const predictedLate = result.risk_score >= 0.5;
                        const actualLate = order.late_flag === 1;
                        const isCorrect = predictedLate === actualLate;
                        return (
                          <Card>
                            <CardContent className="pt-4">
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <p className="text-sm font-medium">Validasi dengan Data Aktual</p>
                                  <div className="flex gap-4 text-sm">
                                    <span>
                                      Prediksi: <Badge variant={predictedLate ? "destructive" : "default"}>
                                        {predictedLate ? "Late" : "On-Time"}
                                      </Badge>
                                    </span>
                                    <span>
                                      Aktual: <Badge variant={actualLate ? "destructive" : "default"}>
                                        {actualLate ? "Late" : "On-Time"}
                                      </Badge>
                                    </span>
                                  </div>
                                </div>
                                <Badge variant={isCorrect ? "default" : "destructive"} className="text-lg px-3 py-1">
                                  {isCorrect ? "✓ Benar" : "✗ Salah"}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      }
                      return null;
                    })()
                  )}

                  {/* Risk Factors */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Faktor Risiko Utama</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {result.top_risk_factors.length > 0 ? (
                        <div className="space-y-3">
                          {result.top_risk_factors.map((factor, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                              <div className="w-full">
                                <div className="flex justify-between text-sm mb-1">
                                  <span>{factor.feature}</span>
                                  <span className="text-muted-foreground">
                                    +{(factor.contribution * 100).toFixed(0)}%
                                  </span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-destructive/60 rounded-full"
                                    style={{ width: `${factor.contribution * 100}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          Tidak ada faktor risiko signifikan terdeteksi
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Recommendations */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Rekomendasi Tindakan</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {result.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="h-full flex items-center justify-center min-h-[400px]">
                  <CardContent className="text-center">
                    <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Belum Ada Prediksi</h3>
                    <p className="text-muted-foreground text-sm max-w-sm">
                      Isi data order di sebelah kiri dan klik "Prediksi Risiko" untuk 
                      melihat analisis risiko keterlambatan pengiriman.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Batch Prediction Tab */}
        <TabsContent value="batch">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Batch Prediction
                </CardTitle>
                <CardDescription>
                  Prediksi risiko untuk banyak order sekaligus dari dataset yang di-upload
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-4">
                  <div className="space-y-2">
                    <Label>Jumlah Order</Label>
                    <Select value={batchSize} onValueChange={setBatchSize}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25 orders</SelectItem>
                        <SelectItem value="50">50 orders</SelectItem>
                        <SelectItem value="100">100 orders</SelectItem>
                        <SelectItem value="200">200 orders</SelectItem>
                        <SelectItem value="500">500 orders</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleBatchPredict} disabled={isBatchLoading || !orderMart?.length}>
                    {isBatchLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="mr-2 h-4 w-4" />
                        Jalankan Batch Prediction
                      </>
                    )}
                  </Button>
                  {batchResult && (
                    <Button variant="outline" onClick={exportBatchToCSV}>
                      <Download className="mr-2 h-4 w-4" />
                      Export CSV
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {batchResult && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold">{batchResult.total}</p>
                      <p className="text-xs text-muted-foreground">Total Prediksi</p>
                    </CardContent>
                  </Card>
                  <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20">
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold text-red-600">{batchResult.sangattinggi + batchResult.tinggi}</p>
                      <p className="text-xs text-muted-foreground">High Risk</p>
                    </CardContent>
                  </Card>
                  <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20">
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold text-yellow-600">{batchResult.sedang}</p>
                      <p className="text-xs text-muted-foreground">Medium Risk</p>
                    </CardContent>
                  </Card>
                  <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold text-green-600">{batchResult.rendah}</p>
                      <p className="text-xs text-muted-foreground">Low Risk</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold">{(batchResult.avgRiskScore * 100).toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Avg Risk Score</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Alerts Triggered Info */}
                {alertsTriggered > 0 && (
                  <Alert className="border-warning bg-warning/10">
                    <Bell className="h-4 w-4" />
                    <AlertTitle className="text-warning">Alerts Triggered</AlertTitle>
                    <AlertDescription>
                      {alertsTriggered} order berisiko tinggi terdeteksi dan ditambahkan ke alert list. 
                      Klik icon bell di header untuk melihat detail.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Model Accuracy (if available) */}
                {modelAccuracy && (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Akurasi Model (vs Data Aktual)</p>
                          <p className="text-xs text-muted-foreground">
                            {modelAccuracy.correct} benar dari {modelAccuracy.total} order yang punya label late_flag
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-bold text-primary">{modelAccuracy.accuracy.toFixed(1)}%</p>
                        </div>
                      </div>
                      <Progress value={modelAccuracy.accuracy} className="mt-2" />
                    </CardContent>
                  </Card>
                )}

                {/* Risk Distribution Bar */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Distribusi Risiko</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-8 flex rounded-lg overflow-hidden">
                      <div 
                        className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${(batchResult.sangattinggi / batchResult.total) * 100}%` }}
                      >
                        {batchResult.sangattinggi > 0 && `${batchResult.sangattinggi}`}
                      </div>
                      <div 
                        className="bg-orange-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${(batchResult.tinggi / batchResult.total) * 100}%` }}
                      >
                        {batchResult.tinggi > 0 && `${batchResult.tinggi}`}
                      </div>
                      <div 
                        className="bg-yellow-500 flex items-center justify-center text-black text-xs font-medium"
                        style={{ width: `${(batchResult.sedang / batchResult.total) * 100}%` }}
                      >
                        {batchResult.sedang > 0 && `${batchResult.sedang}`}
                      </div>
                      <div 
                        className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${(batchResult.rendah / batchResult.total) * 100}%` }}
                      >
                        {batchResult.rendah > 0 && `${batchResult.rendah}`}
                      </div>
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                      <span>🔴 Sangat Tinggi</span>
                      <span>🟠 Tinggi</span>
                      <span>🟡 Sedang</span>
                      <span>🟢 Rendah</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Top High Risk Orders */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Top 10 Order Berisiko Tinggi</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2">
                        {batchResult.predictions.slice(0, 10).map(({ orderId, result }, idx) => {
                          const order = orderMart?.find(o => o.order_id === orderId);
                          return (
                            <div 
                              key={orderId} 
                              className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer"
                              onClick={() => {
                                handleOrderSelect(orderId);
                                setResult(result);
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-mono text-muted-foreground">#{idx + 1}</span>
                                <div>
                                  <p className="text-sm font-medium">{orderId.slice(0, 16)}...</p>
                                  <p className="text-xs text-muted-foreground">
                                    {order?.customer_state} → {order?.seller_states[0] || 'N/A'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={getRiskBadgeVariant(result.risk_bucket) as any}>
                                  {(result.risk_score * 100).toFixed(0)}%
                                </Badge>
                                {order?.late_flag !== null && (
                                  <Badge variant={order.late_flag === 1 ? "destructive" : "outline"} className="text-xs">
                                    {order.late_flag === 1 ? "Late" : "On-Time"}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TabsContent>

        {/* What-If Simulation Tab */}
        <TabsContent value="whatif">
          <WhatIfSimulator initialInput={result ? input : undefined} />
        </TabsContent>

        {/* Risk Trends Tab */}
        <TabsContent value="trends">
          <RiskTrendChart />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Histori Prediksi
              </CardTitle>
              <CardDescription>
                20 prediksi terakhir (session ini)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {predictionHistory.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {predictionHistory.map((item) => (
                      <div 
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleHistorySelect(item)}
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {item.orderId ? `Order: ${item.orderId.slice(0, 12)}...` : 'Manual Input'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.timestamp.toLocaleTimeString('id-ID')} - {item.input.customer_state} → {item.input.seller_state_mode}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getRiskColor(item.result.risk_bucket)}>
                            {(item.result.risk_score * 100).toFixed(0)}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Belum ada histori prediksi</p>
                  <p className="text-sm">Buat prediksi pertama Anda!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info about Python export */}
      <Alert variant="default" className="bg-muted/50">
        <Info className="h-4 w-4" />
        <AlertTitle>Untuk Produksi</AlertTitle>
        <AlertDescription className="text-sm">
          Model saat ini menggunakan heuristik. Untuk akurasi tinggi, export model terlatih 
          dari Python menggunakan <code className="bg-muted px-1 rounded">tensorflowjs_converter</code> dan 
          letakkan di folder <code className="bg-muted px-1 rounded">public/models/</code>. 
          Lihat panduan lengkap di halaman Export.
        </AlertDescription>
      </Alert>
    </div>
  );
}

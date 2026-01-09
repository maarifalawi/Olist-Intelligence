import { useState, useMemo, useCallback } from 'react';
import { Sliders, RefreshCw, TrendingUp, TrendingDown, Minus, ArrowRight, Copy, Trash2, GitCompare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  predictRisk,
  createDefaultInput,
  BRAZILIAN_STATES,
  type PredictionInput,
  type PredictionResult,
} from '@/lib/tfPrediction';

interface ParameterConfig {
  key: keyof PredictionInput;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  type: 'slider' | 'select';
  options?: string[];
}

const PARAMETERS: ParameterConfig[] = [
  { key: 'distance_km_mean', label: 'Jarak Pengiriman', min: 10, max: 3000, step: 50, unit: 'km', type: 'slider' },
  { key: 'estimated_lead_time_days', label: 'Est. Lead Time', min: 3, max: 60, step: 1, unit: 'hari', type: 'slider' },
  { key: 'total_freight', label: 'Biaya Freight', min: 5, max: 200, step: 5, unit: 'BRL', type: 'slider' },
  { key: 'weight_g_mean', label: 'Berat Produk', min: 100, max: 30000, step: 500, unit: 'gram', type: 'slider' },
  { key: 'num_items', label: 'Jumlah Item', min: 1, max: 20, step: 1, unit: 'item', type: 'slider' },
  { key: 'num_sellers', label: 'Jumlah Seller', min: 1, max: 10, step: 1, unit: 'seller', type: 'slider' },
  { key: 'customer_state', label: 'State Customer', min: 0, max: 0, step: 0, unit: '', type: 'select', options: BRAZILIAN_STATES },
  { key: 'seller_state_mode', label: 'State Seller', min: 0, max: 0, step: 0, unit: '', type: 'select', options: BRAZILIAN_STATES },
];

interface Scenario {
  id: string;
  name: string;
  input: PredictionInput;
  result: PredictionResult | null;
}

interface WhatIfSimulatorProps {
  initialInput?: PredictionInput;
}

export function WhatIfSimulator({ initialInput }: WhatIfSimulatorProps) {
  const baseInput = initialInput || createDefaultInput();
  const [mode, setMode] = useState<'single' | 'compare'>('single');
  
  // Single mode state
  const [currentInput, setCurrentInput] = useState<PredictionInput>(baseInput);
  const [baseResult, setBaseResult] = useState<PredictionResult | null>(null);
  const [currentResult, setCurrentResult] = useState<PredictionResult | null>(null);

  // Comparison mode state
  const [scenarioA, setScenarioA] = useState<Scenario>({
    id: 'A',
    name: 'Skenario A',
    input: { ...baseInput },
    result: null,
  });
  const [scenarioB, setScenarioB] = useState<Scenario>({
    id: 'B',
    name: 'Skenario B',
    input: { ...baseInput, distance_km_mean: 1500, estimated_lead_time_days: 35 },
    result: null,
  });

  // Calculate base prediction on mount
  useMemo(() => {
    const calculateBase = async () => {
      const result = await predictRisk(baseInput);
      setBaseResult(result);
      setCurrentResult(result);
      
      // Initialize comparison scenarios
      const resultA = await predictRisk(scenarioA.input);
      const resultB = await predictRisk(scenarioB.input);
      setScenarioA(prev => ({ ...prev, result: resultA }));
      setScenarioB(prev => ({ ...prev, result: resultB }));
    };
    calculateBase();
  }, []);

  const handleParameterChange = useCallback(async (key: keyof PredictionInput, value: number | string) => {
    const newInput = { ...currentInput, [key]: value };
    setCurrentInput(newInput);
    
    const result = await predictRisk(newInput);
    setCurrentResult(result);
  }, [currentInput]);

  const handleScenarioChange = useCallback(async (
    scenario: 'A' | 'B',
    key: keyof PredictionInput,
    value: number | string
  ) => {
    const setter = scenario === 'A' ? setScenarioA : setScenarioB;
    const current = scenario === 'A' ? scenarioA : scenarioB;
    
    const newInput = { ...current.input, [key]: value };
    const result = await predictRisk(newInput);
    
    setter({ ...current, input: newInput, result });
  }, [scenarioA, scenarioB]);

  const handleReset = useCallback(async () => {
    setCurrentInput(baseInput);
    const result = await predictRisk(baseInput);
    setCurrentResult(result);
  }, [baseInput]);

  const handleCopyToScenario = useCallback(async (target: 'A' | 'B') => {
    const result = await predictRisk(currentInput);
    if (target === 'A') {
      setScenarioA({ ...scenarioA, input: { ...currentInput }, result });
    } else {
      setScenarioB({ ...scenarioB, input: { ...currentInput }, result });
    }
  }, [currentInput, scenarioA, scenarioB]);

  const handleSwapScenarios = useCallback(() => {
    const tempA = { ...scenarioA };
    setScenarioA({ ...scenarioB, id: 'A', name: 'Skenario A' });
    setScenarioB({ ...tempA, id: 'B', name: 'Skenario B' });
  }, [scenarioA, scenarioB]);

  const riskDelta = useMemo(() => {
    if (!baseResult || !currentResult) return 0;
    return currentResult.risk_score - baseResult.risk_score;
  }, [baseResult, currentResult]);

  const comparisonDelta = useMemo(() => {
    if (!scenarioA.result || !scenarioB.result) return 0;
    return scenarioB.result.risk_score - scenarioA.result.risk_score;
  }, [scenarioA.result, scenarioB.result]);

  const getDeltaInfo = (delta: number) => {
    if (delta > 0.05) {
      return { icon: TrendingUp, color: 'text-red-500', label: 'Risiko Naik', bgColor: 'bg-red-50 dark:bg-red-950/30' };
    } else if (delta < -0.05) {
      return { icon: TrendingDown, color: 'text-green-500', label: 'Risiko Turun', bgColor: 'bg-green-50 dark:bg-green-950/30' };
    }
    return { icon: Minus, color: 'text-muted-foreground', label: 'Stabil', bgColor: 'bg-muted/30' };
  };

  const getRiskColor = (score: number) => {
    if (score >= 0.75) return 'bg-red-500';
    if (score >= 0.5) return 'bg-orange-500';
    if (score >= 0.25) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getRiskBucket = (score: number) => {
    if (score >= 0.75) return 'Sangat Tinggi';
    if (score >= 0.5) return 'Tinggi';
    if (score >= 0.25) return 'Sedang';
    return 'Rendah';
  };

  const renderParameterSlider = (
    param: ParameterConfig,
    input: PredictionInput,
    onChange: (key: keyof PredictionInput, value: number | string) => void,
    baseValue?: number | string
  ) => (
    <div key={param.key} className="space-y-2">
      <div className="flex justify-between items-center">
        <Label className="text-sm">{param.label}</Label>
        <span className="text-sm font-mono text-muted-foreground">
          {param.type === 'slider' 
            ? `${input[param.key]} ${param.unit}`
            : input[param.key]
          }
        </span>
      </div>
      
      {param.type === 'slider' ? (
        <Slider
          value={[input[param.key] as number]}
          onValueChange={([value]) => onChange(param.key, value)}
          min={param.min}
          max={param.max}
          step={param.step}
          className="py-2"
        />
      ) : (
        <Select
          value={input[param.key] as string}
          onValueChange={(value) => onChange(param.key, value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {param.options?.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {baseValue !== undefined && param.type === 'slider' && baseValue !== input[param.key] && (
        <p className="text-xs text-muted-foreground">
          Base: {baseValue} → {input[param.key]} {param.unit}
        </p>
      )}
    </div>
  );

  const renderRiskCard = (result: PredictionResult | null, label: string, color?: string) => (
    <div className="text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || ''}`}>
        {result ? (result.risk_score * 100).toFixed(1) : '-'}%
      </p>
      <Badge variant={result?.risk_bucket === 'Rendah' ? 'default' : 'destructive'} className="mt-1">
        {result?.risk_bucket || '-'}
      </Badge>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between">
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'single' | 'compare')}>
          <TabsList>
            <TabsTrigger value="single" className="gap-2">
              <Sliders className="w-4 h-4" />
              Simulasi Tunggal
            </TabsTrigger>
            <TabsTrigger value="compare" className="gap-2">
              <GitCompare className="w-4 h-4" />
              Bandingkan 2 Skenario
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {mode === 'single' ? (
        /* Single Scenario Mode */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-primary" />
              Simulasi What-If
            </CardTitle>
            <CardDescription>
              Ubah parameter untuk melihat bagaimana perubahan mempengaruhi risiko
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Risk Comparison Header */}
            {(() => {
              const deltaInfo = getDeltaInfo(riskDelta);
              const DeltaIcon = deltaInfo.icon;
              return (
                <div className={`p-4 rounded-lg ${deltaInfo.bgColor}`}>
                  <div className="flex items-center justify-between">
                    {renderRiskCard(baseResult, 'Baseline')}
                    <div className="flex flex-col items-center px-4">
                      <ArrowRight className="h-6 w-6 text-muted-foreground" />
                      <div className={`flex items-center gap-1 mt-1 ${deltaInfo.color}`}>
                        <DeltaIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {riskDelta > 0 ? '+' : ''}{(riskDelta * 100).toFixed(1)}%
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{deltaInfo.label}</span>
                    </div>
                    {renderRiskCard(currentResult, 'Simulasi')}
                  </div>

                  {/* Visual bar comparison */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-16 text-muted-foreground">Base</span>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${getRiskColor(baseResult?.risk_score || 0)} transition-all`}
                          style={{ width: `${(baseResult?.risk_score || 0) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-16 text-muted-foreground">Simulasi</span>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${getRiskColor(currentResult?.risk_score || 0)} transition-all`}
                          style={{ width: `${(currentResult?.risk_score || 0) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Parameter Sliders */}
            <div className="grid md:grid-cols-2 gap-6">
              {PARAMETERS.map((param) => 
                renderParameterSlider(param, currentInput, handleParameterChange, baseInput[param.key])
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset
              </Button>
              <Button variant="secondary" onClick={() => handleCopyToScenario('A')}>
                <Copy className="mr-2 h-4 w-4" />
                Copy ke A
              </Button>
              <Button variant="secondary" onClick={() => handleCopyToScenario('B')}>
                <Copy className="mr-2 h-4 w-4" />
                Copy ke B
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Comparison Mode */
        <div className="space-y-4">
          {/* Comparison Summary */}
          {(() => {
            const deltaInfo = getDeltaInfo(comparisonDelta);
            const DeltaIcon = deltaInfo.icon;
            return (
              <Card className={deltaInfo.bgColor}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    {/* Scenario A */}
                    <div className="text-center flex-1">
                      <Badge variant="outline" className="mb-2 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        Skenario A
                      </Badge>
                      <p className="text-3xl font-bold">
                        {scenarioA.result ? (scenarioA.result.risk_score * 100).toFixed(1) : '-'}%
                      </p>
                      <Badge variant={scenarioA.result?.risk_bucket === 'Rendah' ? 'default' : 'destructive'} className="mt-2">
                        {scenarioA.result?.risk_bucket || '-'}
                      </Badge>
                    </div>

                    {/* Delta */}
                    <div className="flex flex-col items-center px-6">
                      <span className="text-xs text-muted-foreground mb-1">vs</span>
                      <div className={`flex items-center gap-1 ${deltaInfo.color}`}>
                        <DeltaIcon className="h-5 w-5" />
                        <span className="text-lg font-bold">
                          {comparisonDelta > 0 ? '+' : ''}{(comparisonDelta * 100).toFixed(1)}%
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground mt-1">{deltaInfo.label}</span>
                      <Button variant="ghost" size="sm" onClick={handleSwapScenarios} className="mt-2">
                        <GitCompare className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Scenario B */}
                    <div className="text-center flex-1">
                      <Badge variant="outline" className="mb-2 bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                        Skenario B
                      </Badge>
                      <p className="text-3xl font-bold">
                        {scenarioB.result ? (scenarioB.result.risk_score * 100).toFixed(1) : '-'}%
                      </p>
                      <Badge variant={scenarioB.result?.risk_bucket === 'Rendah' ? 'default' : 'destructive'} className="mt-2">
                        {scenarioB.result?.risk_bucket || '-'}
                      </Badge>
                    </div>
                  </div>

                  {/* Visual comparison bars */}
                  <div className="mt-6 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-20 text-blue-600 font-medium">Skenario A</span>
                      <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${getRiskColor(scenarioA.result?.risk_score || 0)} transition-all`}
                          style={{ width: `${(scenarioA.result?.risk_score || 0) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-20 text-purple-600 font-medium">Skenario B</span>
                      <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${getRiskColor(scenarioB.result?.risk_score || 0)} transition-all`}
                          style={{ width: `${(scenarioB.result?.risk_score || 0) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Side by Side Parameter Editors */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Scenario A */}
            <Card className="border-blue-200 dark:border-blue-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  Skenario A
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {PARAMETERS.map((param) => 
                  renderParameterSlider(
                    param, 
                    scenarioA.input, 
                    (key, value) => handleScenarioChange('A', key, value)
                  )
                )}
              </CardContent>
            </Card>

            {/* Scenario B */}
            <Card className="border-purple-200 dark:border-purple-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  Skenario B
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {PARAMETERS.map((param) => 
                  renderParameterSlider(
                    param, 
                    scenarioB.input, 
                    (key, value) => handleScenarioChange('B', key, value)
                  )
                )}
              </CardContent>
            </Card>
          </div>

          {/* Parameter Differences Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Perbedaan Parameter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {PARAMETERS.filter(p => 
                  scenarioA.input[p.key] !== scenarioB.input[p.key]
                ).map(param => (
                  <div key={param.key} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <span className="text-sm font-medium">{param.label}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-blue-600">
                        A: {scenarioA.input[param.key]} {param.unit}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="text-purple-600">
                        B: {scenarioB.input[param.key]} {param.unit}
                      </span>
                    </div>
                  </div>
                ))}
                {PARAMETERS.filter(p => 
                  scenarioA.input[p.key] !== scenarioB.input[p.key]
                ).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Kedua skenario memiliki parameter yang sama
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

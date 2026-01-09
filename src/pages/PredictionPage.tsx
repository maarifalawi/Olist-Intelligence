import { LateRiskPredictor } from '@/components/prediction/LateRiskPredictor';

export default function PredictionPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          Prediksi Risiko Keterlambatan
        </h1>
        <p className="text-muted-foreground">
          Machine Learning inference di browser dengan TensorFlow.js
        </p>
      </header>

      <LateRiskPredictor />
    </div>
  );
}

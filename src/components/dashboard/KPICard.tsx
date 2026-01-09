import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  label: string;
  value: string | number;
  format?: 'number' | 'percent' | 'currency' | 'days';
  icon?: LucideIcon;
  delta?: number;
  deltaLabel?: string;
  className?: string;
}

export function KPICard({
  label,
  value,
  format = 'number',
  icon: Icon,
  delta,
  deltaLabel,
  className,
}: KPICardProps) {
  const formatValue = (val: string | number): string => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'percent':
        return `${val.toFixed(1)}%`;
      case 'currency':
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val);
      case 'days':
        return `${val.toFixed(1)} hari`;
      case 'number':
      default:
        return new Intl.NumberFormat('id-ID').format(val);
    }
  };

  const getDeltaColor = () => {
    if (delta === undefined || delta === 0) return 'text-muted-foreground';
    return delta > 0 ? 'text-kpi-positive' : 'text-kpi-negative';
  };

  const DeltaIcon = delta === undefined || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;

  return (
    <div className={cn('kpi-card', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="kpi-label">{label}</p>
          <p className="kpi-value font-mono tabular-nums">{formatValue(value)}</p>
          {delta !== undefined && (
            <div className={cn('flex items-center gap-1 text-sm', getDeltaColor())}>
              <DeltaIcon className="h-4 w-4" />
              <span className="font-medium">{Math.abs(delta).toFixed(1)}%</span>
              {deltaLabel && <span className="text-muted-foreground ml-1">{deltaLabel}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className="p-2 bg-accent rounded-lg">
            <Icon className="h-5 w-5 text-accent-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}

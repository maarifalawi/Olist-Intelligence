import { useMemo } from 'react';
import { CohortData } from '@/lib/types';
import { cn } from '@/lib/utils';

interface CohortRetentionMatrixProps {
  data: CohortData[];
  maxMonths?: number;
}

export function CohortRetentionMatrix({ data, maxMonths = 6 }: CohortRetentionMatrixProps) {
  const months = Array.from({ length: maxMonths + 1 }, (_, i) => i);
  
  // Calculate color intensity based on retention value
  const getColor = (value: number) => {
    if (value === 0) return 'bg-muted/30 text-muted-foreground';
    if (value >= 80) return 'bg-primary text-primary-foreground';
    if (value >= 60) return 'bg-primary/80 text-primary-foreground';
    if (value >= 40) return 'bg-primary/60 text-primary-foreground';
    if (value >= 20) return 'bg-primary/40 text-foreground';
    if (value >= 10) return 'bg-primary/20 text-foreground';
    return 'bg-primary/10 text-foreground';
  };

  const formatMonth = (cohort: string) => {
    const [year, month] = cohort.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${monthNames[parseInt(month) - 1]} ${year.slice(2)}`;
  };

  if (data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Tidak ada data cohort untuk ditampilkan
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Cohort</th>
            <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">Customers</th>
            {months.map(m => (
              <th key={m} className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">
                M{m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.cohort} className="border-t border-border/50">
              <td className="py-2 px-3 font-medium text-foreground whitespace-nowrap">
                {formatMonth(row.cohort)}
              </td>
              <td className="py-2 px-2 text-center font-mono text-xs text-muted-foreground">
                {row.customers.toLocaleString()}
              </td>
              {months.map(m => {
                const value = row.retention[m] || 0;
                return (
                  <td key={m} className="py-1 px-1">
                    <div
                      className={cn(
                        'rounded px-2 py-1.5 text-center font-mono text-xs transition-colors',
                        getColor(value)
                      )}
                      title={`${value.toFixed(1)}% retention at month ${m}`}
                    >
                      {value > 0 ? `${value.toFixed(0)}%` : '-'}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span>Retention:</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-primary/10" />
          <span>Rendah</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-primary/40" />
          <span>Sedang</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-primary" />
          <span>Tinggi</span>
        </div>
      </div>
    </div>
  );
}

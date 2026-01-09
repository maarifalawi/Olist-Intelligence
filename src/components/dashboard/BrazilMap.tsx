import React from 'react';
import { OrderLevelMart } from '@/lib/types';

// Simplified Brazil state coordinates (center points) for visualization
const BRAZIL_STATES: Record<string, { x: number; y: number; name: string }> = {
  'AC': { x: 70, y: 280, name: 'Acre' },
  'AL': { x: 490, y: 290, name: 'Alagoas' },
  'AP': { x: 310, y: 80, name: 'Amapá' },
  'AM': { x: 150, y: 180, name: 'Amazonas' },
  'BA': { x: 420, y: 320, name: 'Bahia' },
  'CE': { x: 450, y: 220, name: 'Ceará' },
  'DF': { x: 350, y: 360, name: 'Distrito Federal' },
  'ES': { x: 440, y: 400, name: 'Espírito Santo' },
  'GO': { x: 330, y: 380, name: 'Goiás' },
  'MA': { x: 380, y: 190, name: 'Maranhão' },
  'MT': { x: 230, y: 340, name: 'Mato Grosso' },
  'MS': { x: 260, y: 430, name: 'Mato Grosso do Sul' },
  'MG': { x: 390, y: 410, name: 'Minas Gerais' },
  'PA': { x: 290, y: 180, name: 'Pará' },
  'PB': { x: 480, y: 245, name: 'Paraíba' },
  'PR': { x: 310, y: 480, name: 'Paraná' },
  'PE': { x: 470, y: 265, name: 'Pernambuco' },
  'PI': { x: 410, y: 240, name: 'Piauí' },
  'RJ': { x: 420, y: 440, name: 'Rio de Janeiro' },
  'RN': { x: 475, y: 220, name: 'Rio Grande do Norte' },
  'RS': { x: 300, y: 540, name: 'Rio Grande do Sul' },
  'RO': { x: 140, y: 290, name: 'Rondônia' },
  'RR': { x: 180, y: 80, name: 'Roraima' },
  'SC': { x: 320, y: 510, name: 'Santa Catarina' },
  'SP': { x: 350, y: 440, name: 'São Paulo' },
  'SE': { x: 475, y: 310, name: 'Sergipe' },
  'TO': { x: 340, y: 280, name: 'Tocantins' },
};

interface BrazilMapProps {
  orders: OrderLevelMart[];
  metric?: 'late_rate' | 'order_count' | 'avg_late_days';
}

interface StateData {
  state: string;
  total: number;
  late: number;
  lateRate: number;
  avgLateDays: number;
}

function calculateStateData(orders: OrderLevelMart[]): Map<string, StateData> {
  const stateMap = new Map<string, { total: number; late: number; lateDays: number[] }>();
  
  const delivered = orders.filter(o => o.order_status === 'delivered' && o.late_flag !== null);
  
  for (const order of delivered) {
    const state = order.customer_state;
    if (!stateMap.has(state)) {
      stateMap.set(state, { total: 0, late: 0, lateDays: [] });
    }
    const data = stateMap.get(state)!;
    data.total++;
    if (order.late_flag === 1) {
      data.late++;
      if (order.late_days !== null) {
        data.lateDays.push(order.late_days);
      }
    }
  }
  
  const result = new Map<string, StateData>();
  for (const [state, data] of stateMap) {
    result.set(state, {
      state,
      total: data.total,
      late: data.late,
      lateRate: data.total > 0 ? (data.late / data.total) * 100 : 0,
      avgLateDays: data.lateDays.length > 0
        ? data.lateDays.reduce((a, b) => a + b, 0) / data.lateDays.length
        : 0,
    });
  }
  
  return result;
}

function getColor(value: number, min: number, max: number): string {
  // Color scale from green to red
  const normalized = max > min ? (value - min) / (max - min) : 0;
  
  if (normalized < 0.25) {
    return 'hsl(142, 76%, 36%)'; // Green
  } else if (normalized < 0.5) {
    return 'hsl(48, 96%, 53%)'; // Yellow
  } else if (normalized < 0.75) {
    return 'hsl(25, 95%, 53%)'; // Orange
  } else {
    return 'hsl(0, 84%, 60%)'; // Red
  }
}

export function BrazilMap({ orders, metric = 'late_rate' }: BrazilMapProps) {
  const stateData = calculateStateData(orders);
  const [hoveredState, setHoveredState] = React.useState<string | null>(null);
  
  // Get min/max for color scale
  const values = Array.from(stateData.values()).map(d => {
    switch (metric) {
      case 'order_count': return d.total;
      case 'avg_late_days': return d.avgLateDays;
      default: return d.lateRate;
    }
  });
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  
  const getMetricLabel = () => {
    switch (metric) {
      case 'order_count': return 'Total Orders';
      case 'avg_late_days': return 'Avg Late Days';
      default: return 'Late Rate (%)';
    }
  };

  return (
    <div className="relative">
      {/* SVG Map */}
      <svg viewBox="0 0 560 600" className="w-full max-w-lg mx-auto">
        {/* Background */}
        <rect x="0" y="0" width="560" height="600" fill="transparent" />
        
        {/* State circles */}
        {Object.entries(BRAZIL_STATES).map(([code, pos]) => {
          const data = stateData.get(code);
          const value = data
            ? metric === 'order_count' ? data.total
              : metric === 'avg_late_days' ? data.avgLateDays
              : data.lateRate
            : 0;
          const color = data ? getColor(value, minValue, maxValue) : 'hsl(var(--muted))';
          const radius = data ? Math.max(15, Math.min(35, 15 + (data.total / 500))) : 12;
          
          return (
            <g key={code}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={radius}
                fill={color}
                stroke={hoveredState === code ? 'hsl(var(--foreground))' : 'hsl(var(--border))'}
                strokeWidth={hoveredState === code ? 3 : 1}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredState(code)}
                onMouseLeave={() => setHoveredState(null)}
                opacity={data ? 0.9 : 0.3}
              />
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="text-xs font-bold pointer-events-none select-none"
                fill="white"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
              >
                {code}
              </text>
            </g>
          );
        })}
      </svg>
      
      {/* Tooltip */}
      {hoveredState && stateData.get(hoveredState) && (
        <div className="absolute top-4 right-4 bg-popover border border-border rounded-lg p-3 shadow-lg text-sm">
          <p className="font-bold mb-1">{BRAZIL_STATES[hoveredState]?.name || hoveredState}</p>
          <div className="space-y-0.5 text-muted-foreground">
            <p>Orders: {stateData.get(hoveredState)!.total.toLocaleString()}</p>
            <p>Late Rate: {stateData.get(hoveredState)!.lateRate.toFixed(1)}%</p>
            <p>Avg Late Days: {stateData.get(hoveredState)!.avgLateDays.toFixed(1)}</p>
          </div>
        </div>
      )}
      
      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs">
        <span className="text-muted-foreground">{getMetricLabel()}:</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(142, 76%, 36%)' }} />
          <span>Rendah</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(48, 96%, 53%)' }} />
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(25, 95%, 53%)' }} />
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(0, 84%, 60%)' }} />
          <span>Tinggi</span>
        </div>
      </div>
    </div>
  );
}

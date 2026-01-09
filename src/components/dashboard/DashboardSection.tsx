import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DashboardSectionProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function DashboardSection({
  title,
  subtitle,
  children,
  className,
  action,
}: DashboardSectionProps) {
  return (
    <div className={cn('dashboard-section animate-fade-in', className)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="dashboard-title mb-0">{title}</h2>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
}

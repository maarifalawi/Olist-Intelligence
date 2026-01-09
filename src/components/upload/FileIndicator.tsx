import { cn } from '@/lib/utils';

interface FileIndicatorProps {
  filename: string;
  uploaded: boolean;
  rows?: number;
  columns?: number;
  hasErrors?: boolean;
}

export function FileIndicator({
  filename,
  uploaded,
  rows,
  columns,
  hasErrors,
}: FileIndicatorProps) {
  return (
    <div
      className={cn(
        'file-indicator',
        uploaded && !hasErrors && 'file-indicator-success',
        uploaded && hasErrors && 'bg-destructive/10 text-destructive',
        !uploaded && 'file-indicator-pending'
      )}
    >
      <div
        className={cn(
          'w-2 h-2 rounded-full',
          uploaded && !hasErrors && 'bg-success',
          uploaded && hasErrors && 'bg-destructive',
          !uploaded && 'bg-muted-foreground/50'
        )}
      />
      <div className="flex-1">
        <span className="font-medium">{filename}</span>
        {uploaded && rows !== undefined && (
          <span className="text-xs ml-2 opacity-75">
            {rows.toLocaleString()} baris × {columns} kolom
          </span>
        )}
      </div>
      {uploaded && !hasErrors && (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
      {hasErrors && (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )}
    </div>
  );
}

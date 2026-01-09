import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { RiskAlertSystem } from '@/components/alerts/RiskAlertSystem';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {/* Header with alerts */}
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-8 py-3 flex items-center justify-end">
          <RiskAlertSystem />
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

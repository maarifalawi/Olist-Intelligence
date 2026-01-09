// sidebar kece buat navigasi app
// ada nav items sama status data loaded

import { NavLink, useLocation } from 'react-router-dom';
import {
  Upload,
  Truck,
  MessageSquare,
  DollarSign,
  Database,
  Download,
  BarChart3,
  Brain,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';

// daftar menu navigasi - yang butuh data bakal disabled kalo belum upload
const navItems = [
  { path: '/upload', label: 'Upload Data', icon: Upload },
  { path: '/quality', label: 'Kualitas Data', icon: Database, requiresData: true },
  { path: '/ops', label: 'Ops / Logistik', icon: Truck, requiresData: true },
  { path: '/cx', label: 'CX / Review', icon: MessageSquare, requiresData: true },
  { path: '/biz', label: 'Bisnis', icon: DollarSign, requiresData: true },
  { path: '/prediction', label: 'Prediksi ML', icon: Brain, requiresData: false },
  { path: '/export', label: 'Ekspor', icon: Download, requiresData: true },
];

export function Sidebar() {
  const location = useLocation();
  const { orderMart } = useData();
  const hasData = orderMart.length > 0;

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border h-screen sticky top-0 flex flex-col">
      {/* logo section - Royal Purple branding */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-primary to-accent-foreground rounded-xl shadow-sm">
            <BarChart3 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-sidebar-foreground tracking-tight">Olist Intelligence</h1>
            <p className="text-xs text-muted-foreground font-medium">Ops • CX • Biz</p>
          </div>
        </div>
      </div>

      {/* menu navigasi - disabled kalo data belum ready */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const isDisabled = item.requiresData && !hasData;
          
          return (
            <NavLink
              key={item.path}
              to={isDisabled ? '#' : item.path}
              onClick={(e) => isDisabled && e.preventDefault()}
              className={cn(
                'nav-item',
                isActive ? 'nav-item-active' : 'nav-item-inactive',
                isDisabled && 'opacity-40 cursor-not-allowed hover:bg-transparent'
              )}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* status footer - kasih tau user datanya udah loaded apa belum */}
      <div className="p-4 border-t border-sidebar-border">
        {hasData ? (
          <div className="text-xs text-sidebar-foreground/60">
            <p className="font-medium text-sidebar-foreground mb-1">Data Loaded</p>
            <p>{orderMart.length.toLocaleString()} orders</p>
          </div>
        ) : (
          <div className="text-xs text-sidebar-foreground/60">
            <p>Upload dataset untuk memulai</p>
          </div>
        )}
      </div>
    </aside>
  );
}

// UI komponen untuk menampilkan risk alerts
// menggunakan AlertContext untuk state management

import { AlertTriangle, Bell, BellOff, Settings, X, Check, Volume2, VolumeX, FileSpreadsheet, BarChart3, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useState, useMemo } from 'react';
import { useAlerts } from '@/context/AlertContext';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';

export function RiskAlertSystem() {
  const {
    alerts,
    settings,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAllAlerts,
    updateSettings,
    exportToCSV,
  } = useAlerts();
  
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Statistics calculations
  const stats = useMemo(() => {
    if (alerts.length === 0) return null;

    const avgRiskScore = alerts.reduce((sum, a) => sum + a.riskScore, 0) / alerts.length;
    
    const bucketDistribution = alerts.reduce((acc, a) => {
      acc[a.riskBucket] = (acc[a.riskBucket] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group by date
    const alertsByDate = alerts.reduce((acc, a) => {
      const date = format(a.timestamp, 'yyyy-MM-dd');
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const todayCount = alertsByDate[todayKey] || 0;

    return {
      total: alerts.length,
      avgRiskScore,
      bucketDistribution,
      alertsByDate,
      todayCount,
      unreadCount,
    };
  }, [alerts, unreadCount]);

  // Filter alerts by date range for export
  const filteredAlerts = useMemo(() => {
    if (!dateRange?.from) return alerts;
    
    return alerts.filter(alert => {
      const alertDate = alert.timestamp;
      if (dateRange.from && alertDate < dateRange.from) return false;
      if (dateRange.to) {
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        if (alertDate > endOfDay) return false;
      }
      return true;
    });
  }, [alerts, dateRange]);

  const handleExportWithFilter = () => {
    exportToCSV(dateRange);
  };

  const getRiskColor = (score: number) => {
    if (score >= 0.8) return 'text-destructive';
    if (score >= 0.6) return 'text-warning';
    return 'text-muted-foreground';
  };

  const getRiskBgColor = (score: number) => {
    if (score >= 0.8) return 'bg-destructive/10';
    if (score >= 0.6) return 'bg-warning/10';
    return 'bg-muted';
  };

  const getBucketColor = (bucket: string) => {
    switch (bucket) {
      case 'Sangat Tinggi': return 'bg-destructive text-destructive-foreground';
      case 'Tinggi': return 'bg-warning text-warning-foreground';
      case 'Sedang': return 'bg-secondary text-secondary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="relative">
            {settings.isEnabled ? (
              <Bell className="h-4 w-4" />
            ) : (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            )}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center font-medium">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Risk Alerts
            </SheetTitle>
            <SheetDescription>
              Notifikasi otomatis untuk order berisiko tinggi
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {/* Controls */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={settings.isEnabled}
                  onCheckedChange={(checked) => updateSettings({ isEnabled: checked })}
                  id="alert-enabled"
                />
                <Label htmlFor="alert-enabled" className="text-sm">
                  {settings.isEnabled ? 'Alerts aktif' : 'Alerts nonaktif'}
                </Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowStats(!showStats)} title="Statistik">
                  <BarChart3 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={markAllAsRead} disabled={unreadCount === 0}>
                  <Check className="h-4 w-4 mr-1" />
                  Tandai dibaca
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)}>
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Statistics Panel */}
            {showStats && stats && (
              <Card className="p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Alert Statistics</span>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-primary">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Total Alerts</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-warning">{stats.todayCount}</p>
                    <p className="text-xs text-muted-foreground">Hari Ini</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-destructive">{Math.round(stats.avgRiskScore * 100)}%</p>
                    <p className="text-xs text-muted-foreground">Avg Risk</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Distribusi Risk Bucket</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.bucketDistribution).map(([bucket, count]) => (
                      <Badge key={bucket} className={getBucketColor(bucket)}>
                        {bucket}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>

                {Object.keys(stats.alertsByDate).length > 1 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Alerts per Hari (7 hari terakhir)</p>
                      <div className="space-y-1">
                        {Object.entries(stats.alertsByDate)
                          .sort((a, b) => b[0].localeCompare(a[0]))
                          .slice(0, 7)
                          .map(([date, count]) => (
                            <div key={date} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{format(new Date(date), 'd MMM yyyy', { locale: id })}</span>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="h-2 bg-primary rounded-full" 
                                  style={{ width: `${Math.min(count * 10, 100)}px` }}
                                />
                                <span className="font-medium w-6 text-right">{count}</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </>
                )}
              </Card>
            )}

            {/* Settings Panel */}
            {showSettings && (
              <Card className="p-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Risk Threshold: {Math.round(settings.threshold * 100)}%</Label>
                    <Badge variant="outline">{settings.threshold >= 0.8 ? 'Sangat Tinggi' : settings.threshold >= 0.6 ? 'Tinggi' : 'Sedang'}</Badge>
                  </div>
                  <Slider
                    value={[settings.threshold]}
                    onValueChange={([v]) => updateSettings({ threshold: v })}
                    min={0.4}
                    max={0.95}
                    step={0.05}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Alert akan dikirim ketika risk score ≥ {Math.round(settings.threshold * 100)}%
                  </p>
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {settings.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
                    <Label className="text-sm">Sound notification</Label>
                  </div>
                  <Switch 
                    checked={settings.soundEnabled} 
                    onCheckedChange={(checked) => updateSettings({ soundEnabled: checked })} 
                  />
                </div>

                <Separator />

                {/* Date Range Filter for Export */}
                <div className="space-y-2">
                  <Label className="text-sm">Export Date Range</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
                        <Calendar className="h-4 w-4 mr-2" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, 'd MMM', { locale: id })} - {format(dateRange.to, 'd MMM yyyy', { locale: id })}
                            </>
                          ) : (
                            format(dateRange.from, 'd MMM yyyy', { locale: id })
                          )
                        ) : (
                          <span className="text-muted-foreground">Semua waktu</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={1}
                      />
                      <div className="p-2 border-t">
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setDateRange(undefined)}>
                          Reset
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  {dateRange?.from && (
                    <p className="text-xs text-muted-foreground">
                      {filteredAlerts.length} dari {alerts.length} alerts dalam range
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleExportWithFilter} disabled={filteredAlerts.length === 0} className="flex-1">
                    <FileSpreadsheet className="h-4 w-4 mr-1" />
                    Export ({filteredAlerts.length})
                  </Button>
                  <Button variant="destructive" size="sm" onClick={clearAllAlerts} disabled={alerts.length === 0} className="flex-1">
                    <X className="h-4 w-4 mr-1" />
                    Hapus ({alerts.length})
                  </Button>
                </div>
              </Card>
            )}

            <Separator />

            {/* Alerts List */}
            <ScrollArea className="h-[400px] pr-4">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12">
                  <Bell className="h-12 w-12 mb-4 opacity-20" />
                  <p className="font-medium">Belum ada alert</p>
                  <p className="text-sm">Jalankan batch prediction untuk mendapat alert otomatis</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <Card
                      key={alert.id}
                      className={`p-3 cursor-pointer transition-all hover:shadow-md ${
                        !alert.isRead ? 'border-l-4 border-l-warning bg-warning/5' : ''
                      }`}
                      onClick={() => markAsRead(alert.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-mono text-sm font-medium ${getRiskColor(alert.riskScore)}`}>
                              {Math.round(alert.riskScore * 100)}%
                            </span>
                            <Badge variant="outline" className={getRiskBgColor(alert.riskScore)}>
                              {alert.riskBucket}
                            </Badge>
                            {!alert.isRead && (
                              <span className="h-2 w-2 bg-warning rounded-full animate-pulse" />
                            )}
                          </div>
                          <p className="text-sm font-medium truncate">
                            Order: {alert.orderId}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {alert.topFactors.join(' • ')}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {alert.timestamp.toLocaleString('id-ID')}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}


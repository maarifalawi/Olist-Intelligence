// context untuk risk alert system
// memungkinkan trigger alert dari komponen manapun

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { toast } from 'sonner';
import type { PredictionResult } from '@/lib/tfPrediction';
import type { DateRange } from 'react-day-picker';

export interface RiskAlert {
  id: string;
  orderId: string;
  riskScore: number;
  riskBucket: string;
  timestamp: Date;
  isRead: boolean;
  topFactors: string[];
}

interface AlertSettings {
  isEnabled: boolean;
  threshold: number;
  soundEnabled: boolean;
}

interface AlertContextType {
  alerts: RiskAlert[];
  settings: AlertSettings;
  unreadCount: number;
  addAlert: (orderId: string, result: PredictionResult) => void;
  addBatchAlerts: (predictions: Array<{ orderId: string; result: PredictionResult }>) => number;
  markAsRead: (alertId: string) => void;
  markAllAsRead: () => void;
  clearAllAlerts: () => void;
  updateSettings: (settings: Partial<AlertSettings>) => void;
  exportToCSV: (dateRange?: DateRange) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [settings, setSettings] = useState<AlertSettings>({
    isEnabled: true,
    threshold: 0.7,
    soundEnabled: true,
  });

  const unreadCount = alerts.filter(a => !a.isRead).length;

  const playAlertSound = useCallback(() => {
    if (!settings.soundEnabled) return;
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch (e) {
      console.log('Audio not available');
    }
  }, [settings.soundEnabled]);

  const addAlert = useCallback((orderId: string, result: PredictionResult) => {
    if (!settings.isEnabled) return;
    if (result.risk_score < settings.threshold) return;

    const newAlert: RiskAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      orderId,
      riskScore: result.risk_score,
      riskBucket: result.risk_bucket,
      timestamp: new Date(),
      isRead: false,
      topFactors: result.top_risk_factors.slice(0, 3).map(f => f.feature),
    };

    setAlerts(prev => [newAlert, ...prev].slice(0, 100));

    const riskPercent = Math.round(result.risk_score * 100);
    toast.warning(`🚨 High Risk: ${orderId.slice(0, 8)}...`, {
      description: `Risk: ${riskPercent}% (${result.risk_bucket})`,
      duration: 3000,
    });

    playAlertSound();
  }, [settings, playAlertSound]);

  const addBatchAlerts = useCallback((predictions: Array<{ orderId: string; result: PredictionResult }>) => {
    if (!settings.isEnabled) return 0;

    const highRiskPredictions = predictions.filter(p => p.result.risk_score >= settings.threshold);
    
    if (highRiskPredictions.length === 0) return 0;

    const newAlerts: RiskAlert[] = highRiskPredictions.map(({ orderId, result }) => ({
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      orderId,
      riskScore: result.risk_score,
      riskBucket: result.risk_bucket,
      timestamp: new Date(),
      isRead: false,
      topFactors: result.top_risk_factors.slice(0, 3).map(f => f.feature),
    }));

    setAlerts(prev => [...newAlerts, ...prev].slice(0, 100));

    // Show summary toast
    const sangattinggi = highRiskPredictions.filter(p => p.result.risk_bucket === 'Sangat Tinggi').length;
    const tinggi = highRiskPredictions.filter(p => p.result.risk_bucket === 'Tinggi').length;

    toast.warning(`🚨 ${highRiskPredictions.length} High Risk Orders Detected`, {
      description: `${sangattinggi} sangat tinggi, ${tinggi} tinggi`,
      duration: 5000,
    });

    playAlertSound();

    return highRiskPredictions.length;
  }, [settings, playAlertSound]);

  const markAsRead = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(a => 
      a.id === alertId ? { ...a, isRead: true } : a
    ));
  }, []);

  const markAllAsRead = useCallback(() => {
    setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
  }, []);

  const clearAllAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const updateSettings = useCallback((newSettings: Partial<AlertSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const exportToCSV = useCallback((dateRange?: DateRange) => {
    // Filter alerts by date range if provided
    let alertsToExport = alerts;
    
    if (dateRange?.from) {
      alertsToExport = alerts.filter(alert => {
        const alertDate = alert.timestamp;
        if (dateRange.from && alertDate < dateRange.from) return false;
        if (dateRange.to) {
          const endOfDay = new Date(dateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          if (alertDate > endOfDay) return false;
        }
        return true;
      });
    }

    if (alertsToExport.length === 0) {
      toast.error('Tidak ada alert untuk di-export dalam range yang dipilih');
      return;
    }

    const headers = [
      'Alert ID',
      'Order ID',
      'Risk Score (%)',
      'Risk Bucket',
      'Timestamp',
      'Status',
      'Top Risk Factors',
    ];

    const rows = alertsToExport.map(alert => [
      alert.id,
      alert.orderId,
      (alert.riskScore * 100).toFixed(1),
      alert.riskBucket,
      alert.timestamp.toISOString(),
      alert.isRead ? 'Read' : 'Unread',
      alert.topFactors.join('; '),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Include date range in filename if specified
    let filename = 'risk_alerts';
    if (dateRange?.from) {
      const fromStr = dateRange.from.toISOString().split('T')[0];
      const toStr = dateRange.to ? dateRange.to.toISOString().split('T')[0] : fromStr;
      filename += `_${fromStr}_to_${toStr}`;
    } else {
      filename += `_${new Date().toISOString().split('T')[0]}`;
    }
    link.download = `${filename}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`${alertsToExport.length} alerts berhasil di-export ke CSV`);
  }, [alerts]);

  return (
    <AlertContext.Provider
      value={{
        alerts,
        settings,
        unreadCount,
        addAlert,
        addBatchAlerts,
        markAsRead,
        markAllAsRead,
        clearAllAlerts,
        updateSettings,
        exportToCSV,
      }}
    >
      {children}
    </AlertContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlerts must be used within AlertProvider');
  }
  return context;
}

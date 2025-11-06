'use client';

import { useState, useEffect, useCallback } from 'react';
import { ServiceCard } from './ServiceCard';
import { Sidebar } from './Sidebar';
import { ServiceStatus } from '@/lib/control/status';
import { RefreshCw, Download, Power, Activity } from 'lucide-react';
import { TradingLoopControl } from '@/components/TradingLoopControl';
import { HistoryPanel } from '@/components/admin/HistoryPanel';
import { SentimentMonitor } from '@/components/sentiment/SentimentMonitor';
import { cn } from '@/lib/utils';

interface ControlDashboardProps {
  baseUrl: string;
}

export function ControlDashboard({ baseUrl }: ControlDashboardProps) {
  const [services, setServices] = useState<Record<string, ServiceStatus>>({});
  const [selectedService, setSelectedService] = useState<ServiceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [uptime, setUptime] = useState(0);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/control/status?baseUrl=${encodeURIComponent(baseUrl)}`);
      if (!response.ok) throw new Error('Failed to fetch status');
      
      const data = await response.json();
      setServices(data.services || {});
      setUptime(data.uptime || 0);
      setLastChecked(new Date());
    } catch (error) {
      console.error('Error fetching control status:', error);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  const handleDiagnostics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/control/diagnostics?baseUrl=${encodeURIComponent(baseUrl)}`, {
        method: 'POST',
      });
      
      if (!response.ok) throw new Error('Diagnostics failed');
      
      const data = await response.json();
      setServices(data.status?.services || {});
      setUptime(data.status?.uptime || 0);
      setLastChecked(new Date());
    } catch (error) {
      console.error('Error running diagnostics:', error);
      alert('Failed to run diagnostics');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryAll = async () => {
    await handleDiagnostics();
  };

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear all cache? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/control/clear-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to clear cache');
      
      const result = await response.json();
      alert(`Cache cleared: ${result.cleared} keys cleared, ${result.failed} failed`);
      
      // Refresh status after clearing
      setTimeout(() => fetchStatus(), 1000);
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert('Failed to clear cache');
    }
  };

  const handleExport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      uptime,
      services: Object.values(services),
      checked: Object.keys(services).length,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `control-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 30000); // Every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, fetchStatus]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const serviceList = Object.values(services);

  return (
    <div className="flex flex-col w-full h-full">
      {/* Header */}
      <div className="p-6 border-b border-[#222] bg-[#141414] flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#f5f5e8] uppercase tracking-wide mb-1">
              Control Room
            </h1>
            <p className="text-sm text-[#a9a9a9]">
              Unified system monitoring and diagnostics
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Uptime Gauge */}
            <div className="flex items-center gap-2 px-4 py-2 bg-[#181818] border border-[#222] rounded">
              <Activity size={16} className={cn(
                uptime >= 90 ? "text-[#00b686]" :
                uptime >= 70 ? "text-yellow-500" :
                "text-[#ff4d4d]"
              )} />
              <div className="text-sm">
                <span className="text-[#a9a9a9]">Uptime: </span>
                <span className={cn(
                  "font-semibold",
                  uptime >= 90 ? "text-[#00b686]" :
                  uptime >= 70 ? "text-yellow-500" :
                  "text-[#ff4d4d]"
                )}>
                  {uptime.toFixed(1)}%
                </span>
              </div>
            </div>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border",
                autoRefresh
                  ? "bg-[#181818] text-[#f5f5e8] border-[#3a3a3a]"
                  : "bg-[#141414] text-[#a9a9a9] border-[#222] hover:text-[#f5f5e8]"
              )}
            >
              <Power size={16} className={cn(autoRefresh && "text-[#00b686]")} />
              Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
            </button>
            
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#181818] text-[#f5f5e8] border border-[#222] hover:border-[#3a3a3a] transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={cn(loading && "animate-spin")} />
              Refresh
            </button>

            <button
              onClick={handleDiagnostics}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#181818] text-[#f5f5e8] border border-[#222] hover:border-[#3a3a3a] transition-colors disabled:opacity-50"
            >
              <Activity size={16} />
              Full Diagnostics
            </button>

            <button
              onClick={handleRetryAll}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#181818] text-[#f5f5e8] border border-[#222] hover:border-[#3a3a3a] transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={cn(loading && "animate-spin")} />
              Retry All
            </button>

            <button
              onClick={handleClearCache}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#ff4d4d]/20 text-[#ff4d4d] border border-[#ff4d4d]/30 hover:bg-[#ff4d4d]/30 transition-colors"
            >
              Clear Cache
            </button>

            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#181818] text-[#f5f5e8] border border-[#222] hover:border-[#3a3a3a] transition-colors"
            >
              <Download size={16} />
              Export
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-[#a9a9a9]">
          <span>Last checked: {formatTime(lastChecked)}</span>
          <span>Services monitored: {serviceList.length}</span>
          <span>OK: {serviceList.filter(s => s.status === 'OK').length}</span>
          <span>Errors: {serviceList.filter(s => s.status === 'ERROR').length}</span>
        </div>
      </div>

      {/* Service Grid */}
      <div className={cn(
        "flex-1 overflow-y-auto p-6 transition-all duration-300",
        selectedService ? "mr-[35%]" : "mr-0"
      )}>
        {/* Trading Simulator Control */}
        <div className="mb-6">
          <TradingLoopControl />
        </div>

        {/* History Store */}
        <div className="mb-6">
          <HistoryPanel />
        </div>

        {/* Sentiment Monitor */}
        <div className="mb-6">
          <SentimentMonitor />
        </div>

        {loading && serviceList.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="animate-spin text-[#a9a9a9]" size={32} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-min">
            {serviceList.map((service) => (
              <ServiceCard
                key={service.name}
                name={service.name}
                status={service.status}
                latency={service.latency}
                http={service.code}
                onClick={() => setSelectedService(service)}
                logsCount={service.logs?.length || 0}
                lastUpdate={service.lastUpdate}
                errorCount={service.errorCount || 0}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <Sidebar
        service={selectedService}
        onClose={() => setSelectedService(null)}
      />
    </div>
  );
}


'use client';

import { useEffect, useState, useCallback } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { HealthCheckResult } from '@/lib/healthChecks';
import { ServiceStatus } from '@/lib/control/status';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';
import { RefreshCw, Download, Power, Activity, Eye } from 'lucide-react';
import { TradingLoopControl } from '@/components/TradingLoopControl';
import { HistoryPanel } from '@/components/admin/HistoryPanel';
import { LogsModal } from '@/components/control/LogsModal';

interface LatencyHistory {
  service: string;
  data: Array<{ time: number; latency: number }>;
}

export default function AdminControlRoomPage() {
  const [healthResults, setHealthResults] = useState<HealthCheckResult[]>([]);
  const [controlServices, setControlServices] = useState<Record<string, ServiceStatus>>({});
  const [latencyHistory, setLatencyHistory] = useState<Map<string, LatencyHistory>>(new Map());
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [selectedServiceForLogs, setSelectedServiceForLogs] = useState<string | null>(null);
  const [uptime, setUptime] = useState(0);

  const updateLatencyHistory = useCallback((result: HealthCheckResult) => {
    setLatencyHistory(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(result.service) || { service: result.service, data: [] };
      
      existing.data.push({
        time: result.timestamp,
        latency: result.latency,
      });

      if (existing.data.length > 10) {
        existing.data = existing.data.slice(-10);
      }

      newMap.set(result.service, existing);
      return newMap;
    });
  }, []);

  const runHealthChecks = useCallback(async () => {
    try {
      const response = await fetch('/api/health');
      if (!response.ok) throw new Error('Failed to fetch health checks');
      
      const data = await response.json();
      const checks: HealthCheckResult[] = data.results || [];
      setHealthResults(checks);
      setLastChecked(new Date());
      
      checks.forEach(updateLatencyHistory);
    } catch (error) {
      console.error('Error running health checks:', error);
    }
  }, [updateLatencyHistory]);

  const fetchControlStatus = useCallback(async () => {
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(`/api/control/status?baseUrl=${encodeURIComponent(baseUrl)}`);
      if (!response.ok) throw new Error('Failed to fetch control status');
      
      const data = await response.json();
      setControlServices(data.services || {});
      setUptime(data.uptime || 0);
    } catch (error) {
      console.error('Error fetching control status:', error);
    }
  }, []);

  const runAllChecks = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([runHealthChecks(), fetchControlStatus()]);
    } finally {
      setLoading(false);
    }
  }, [runHealthChecks, fetchControlStatus]);

  const retryCheck = useCallback(async (serviceName: string) => {
    const serviceMap: Record<string, string> = {
      'Redis': 'redis',
      'Hugging Face API': 'huggingface',
      'Sentiment System': 'huggingface',
      'Market API': 'market',
      'Local News': 'localnews',
      'Redis Latency': 'redis-latency',
      'Vercel Environment': 'vercel-env',
      'GitHub Sync': 'github',
    };

    const serviceKey = serviceMap[serviceName];
    if (!serviceKey) return;

    try {
      const response = await fetch(`/api/health?service=${serviceKey}`);
      if (!response.ok) throw new Error('Failed to check service');
      
      const data = await response.json();
      const result: HealthCheckResult = data.result;
      
      setHealthResults(prev => prev.map(r => r.service === serviceName ? result : r));
      updateLatencyHistory(result);
    } catch (error) {
      console.error('Error retrying check:', error);
    }
  }, [updateLatencyHistory]);

  useEffect(() => {
    runAllChecks();
  }, [runAllChecks]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      runAllChecks();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, runAllChecks]);

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
      
      setTimeout(() => runAllChecks(), 1000);
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert('Failed to clear cache');
    }
  };

  const exportReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      uptime,
      healthResults,
      controlServices: Object.values(controlServices),
      totalServices: healthResults.length + Object.keys(controlServices).length,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-control-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const calculateUptime = () => {
    const allServices = [...healthResults, ...Object.values(controlServices).map(s => ({
      service: s.name,
      status: s.status === 'OK' ? 'ok' : s.status === 'WARNING' ? 'warning' : 'error',
      latency: s.latency,
      message: s.error || 'OK',
      timestamp: Date.now(),
    }))];
    
    if (allServices.length === 0) return 0;
    const okCount = allServices.filter(s => s.status === 'ok' || s.status === 'OK').length;
    return Math.round((okCount / allServices.length) * 100);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStatusBadge = (status: string, serviceName?: string, details?: any) => {
    if (serviceName === 'Sentiment System' || serviceName === 'Hugging Face API') {
      const hfStatus = details?.status;
      if (hfStatus === 'DISABLED') return '⚪';
      if (hfStatus === 'OK' || status === 'ok') return '🟢';
      if (hfStatus === 'AUTH_ERROR') return '🟡';
      if (status === 'error') return '🔴';
      return '🟡';
    }
    
    switch (status) {
      case 'ok':
      case 'OK':
        return '🟢';
      case 'warning':
      case 'WARNING':
        return '🟡';
      case 'error':
      case 'ERROR':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
      case 'OK':
        return 'border-[#00b686] bg-[#00b686]/10';
      case 'warning':
      case 'WARNING':
        return 'border-yellow-500 bg-yellow-500/10';
      case 'error':
      case 'ERROR':
        return 'border-[#ff4d4d] bg-[#ff4d4d]/10';
      default:
        return 'border-[#222] bg-[#141414]';
    }
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 500) return 'text-[#00b686]';
    if (latency < 1000) return 'text-yellow-500';
    return 'text-[#ff4d4d]';
  };

  // Merge all services from both sources
  const allServices = [
    ...healthResults.map(r => ({
      name: r.service === 'Hugging Face API' ? 'Sentiment System' : r.service,
      status: r.status,
      latency: r.latency,
      message: r.message,
      details: r.details,
      source: 'health' as const,
      healthResult: r,
    })),
    ...Object.values(controlServices).map(s => ({
      name: s.name,
      status: s.status === 'OK' ? 'ok' : s.status === 'WARNING' ? 'warning' : 'error',
      latency: s.latency,
      message: s.error || 'OK',
      details: s.json || {},
      source: 'control' as const,
      serviceStatus: s,
    })),
  ];

  // Deduplicate by name (prefer control services)
  const uniqueServices = new Map<string, typeof allServices[0]>();
  allServices.forEach(s => {
    if (!uniqueServices.has(s.name) || s.source === 'control') {
      uniqueServices.set(s.name, s);
    }
  });

  const servicesList = Array.from(uniqueServices.values());
  const calculatedUptime = calculateUptime();
  const okCount = servicesList.filter(s => s.status === 'ok' || s.status === 'OK').length;
  const errorCount = servicesList.filter(s => s.status === 'error' || s.status === 'ERROR').length;

  return (
    <div className="flex flex-col w-full h-screen bg-[#0c0c0d] text-[#f5f5e8] overflow-hidden">
      <HeaderBar />
      <main className="flex-grow h-[calc(100vh-90px)] overflow-y-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-[#f5f5e8] uppercase tracking-wide">
                🧠 ADMIN CONTROL ROOM
              </h1>
              <div className={cn(
                "w-3 h-3 rounded-full",
                calculatedUptime >= 80 ? "bg-[#00b686]" : calculatedUptime >= 50 ? "bg-yellow-500" : "bg-[#ff4d4d]"
              )} />
              <span className={cn(
                "text-sm font-bold",
                calculatedUptime >= 80 ? "text-[#00b686]" : calculatedUptime >= 50 ? "text-yellow-500" : "text-[#ff4d4d]"
              )}>
                {calculatedUptime}%
              </span>
            </div>
            <div className="text-right text-xs text-[#a9a9a9]">
              <div>Services: {servicesList.length} | OK: {okCount} | Errors: {errorCount}</div>
              <div>Last checked: {formatTime(lastChecked)}</div>
            </div>
          </div>
          <p className="text-sm text-[#a9a9a9] mb-4">
            Unified monitoring, diagnostics, and log visualization
          </p>
          
          <div className="flex items-center gap-4 flex-wrap">
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
              onClick={runAllChecks}
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
              <Power size={16} />
              Clear Cache
            </button>
            
            <button
              onClick={exportReport}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#181818] text-[#f5f5e8] border border-[#222] hover:border-[#3a3a3a] transition-colors"
            >
              <Download size={16} />
              Export Logs
            </button>
          </div>
          
          <TradingLoopControl />
        </div>

        {/* History Store */}
        <div className="mb-6">
          <HistoryPanel />
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {servicesList.map((service) => {
            const history = latencyHistory.get(service.name);
            const chartData = history?.data || [];

            return (
              <div
                key={service.name}
                className={cn(
                  "bg-[#181818] border p-4 transition-all",
                  getStatusColor(service.status),
                  service.name === 'Sentiment System' && service.details?.status === 'DISABLED' && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{getStatusBadge(service.status, service.name, service.details)}</span>
                      <h3 className="text-sm font-semibold text-[#f5f5e8]">
                        {service.name}
                      </h3>
                    </div>
                    <p className="text-xs text-[#a9a9a9] mb-2">{service.message}</p>
                    {service.name === 'Sentiment System' && service.details?.status === 'DISABLED' && (
                      <p className="text-xs text-[#a9a9a9] mb-2 italic">
                        Disabled — re-enable by adding HUGGINGFACE_API_KEY
                      </p>
                    )}
                    {service.name === 'Sentiment System' && service.details?.model && service.details?.status !== 'DISABLED' && (
                      <p className="text-xs text-[#a9a9a9] mb-2">
                        Model: {service.details.model}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-xs font-medium",
                        getLatencyColor(service.latency)
                      )}>
                        {service.latency}ms
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedServiceForLogs(service.name)}
                          className="text-xs text-[#a9a9a9] hover:text-[#f5f5e8] transition-colors flex items-center gap-1"
                        >
                          <Eye size={12} />
                          View Logs
                        </button>
                        <button
                          onClick={() => retryCheck(service.name)}
                          className="text-xs text-[#a9a9a9] hover:text-[#f5f5e8] transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sparkline */}
                <div className="mt-2 h-12">
                  {chartData.length >= 2 ? (
                    <ResponsiveContainer width="100%" height={48}>
                      <LineChart data={chartData.map((d, i) => ({ time: i, latency: d.latency }))}>
                        <Line
                          type="monotone"
                          dataKey="latency"
                          stroke={service.status === 'ok' ? '#00b686' : service.status === 'warning' ? '#fbbf24' : '#ff4d4d'}
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                        <YAxis hide domain={['auto', 'auto']} />
                        <XAxis hide />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-12 flex items-center text-xs text-[#a9a9a9]">
                      Collecting data...
                    </div>
                  )}
                </div>

                {/* Details */}
                {service.details && Object.keys(service.details).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#222] text-xs text-[#a9a9a9]">
                    {Object.entries(service.details).slice(0, 3).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span>{key}:</span>
                        <span className="text-[#f5f5e8] truncate ml-2">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {loading && servicesList.length === 0 && (
          <div className="flex items-center justify-center h-64 text-[#a9a9a9]">
            <RefreshCw className="animate-spin mr-2" size={20} />
            Running initial health checks...
          </div>
        )}
      </main>

      {/* Logs Modal */}
      {selectedServiceForLogs && (
        <LogsModal
          serviceName={selectedServiceForLogs}
          isOpen={!!selectedServiceForLogs}
          onClose={() => setSelectedServiceForLogs(null)}
        />
      )}
    </div>
  );
}


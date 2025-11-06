'use client';

import { useEffect, useState, useCallback } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { HealthCheckResult } from '@/lib/healthChecks';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';
import { RefreshCw, Download, Power } from 'lucide-react';
import { TradingLoopControl } from '@/components/TradingLoopControl';

interface LatencyHistory {
  service: string;
  data: Array<{ time: number; latency: number }>;
}

export default function AdminPage() {
  const [results, setResults] = useState<HealthCheckResult[]>([]);
  const [latencyHistory, setLatencyHistory] = useState<Map<string, LatencyHistory>>(new Map());
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const updateLatencyHistory = useCallback((result: HealthCheckResult) => {
    setLatencyHistory(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(result.service) || { service: result.service, data: [] };
      
      existing.data.push({
        time: result.timestamp,
        latency: result.latency,
      });

      // Keep only last 10 samples
      if (existing.data.length > 10) {
        existing.data = existing.data.slice(-10);
      }

      newMap.set(result.service, existing);
      return newMap;
    });
  }, []);

  const runChecks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/health');
      if (!response.ok) throw new Error('Failed to fetch health checks');
      
      const data = await response.json();
      const checks: HealthCheckResult[] = data.results || [];
      setResults(checks);
      setLastChecked(new Date());
      
      // Update latency history
      checks.forEach(updateLatencyHistory);
    } catch (error) {
      console.error('Error running health checks:', error);
    } finally {
      setLoading(false);
    }
  }, [updateLatencyHistory]);

  const retryCheck = useCallback(async (serviceName: string) => {
    const serviceMap: Record<string, string> = {
      'Redis': 'redis',
      'CryptoPanic API': 'cryptopanic',
      'Hugging Face API': 'huggingface',
      'Market API': 'market',
      'News API': 'news',
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
      
      setResults(prev => prev.map(r => r.service === serviceName ? result : r));
      updateLatencyHistory(result);
    } catch (error) {
      console.error('Error retrying check:', error);
    }
  }, [updateLatencyHistory]);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      runChecks();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, runChecks]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ok':
        return '🟢';
      case 'warning':
        return '🟡';
      case 'error':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
        return 'border-[#00b686] bg-[#00b686]/10';
      case 'warning':
        return 'border-yellow-500 bg-yellow-500/10';
      case 'error':
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

  const exportReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      results: results.map(r => ({
        service: r.service,
        status: r.status,
        latency: r.latency,
        message: r.message,
        details: r.details,
      })),
      uptime: calculateUptime(),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `health-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const calculateUptime = () => {
    if (results.length === 0) return 0;
    const okCount = results.filter(r => r.status === 'ok').length;
    return Math.round((okCount / results.length) * 100);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const renderSparkline = (serviceName: string) => {
    const history = latencyHistory.get(serviceName);
    if (!history || history.data.length < 2) {
      return (
        <div className="h-12 flex items-center text-xs text-[#a9a9a9]">
          No data yet
        </div>
      );
    }

    const chartData = history.data.map((point, index) => ({
      time: index,
      latency: point.latency,
    }));

    return (
      <ResponsiveContainer width="100%" height={48}>
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="latency"
            stroke="#00b686"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <YAxis hide domain={['auto', 'auto']} />
          <XAxis hide />
          <Tooltip
            contentStyle={{
              backgroundColor: '#181818',
              border: '1px solid #222',
              borderRadius: '4px',
              color: '#f5f5e8',
              fontSize: '10px',
            }}
            formatter={(value: number) => [`${value}ms`, 'Latency']}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const uptime = calculateUptime();

  return (
    <div className="flex flex-col w-full h-screen bg-[#0c0c0d] text-[#f5f5e8] overflow-hidden">
      <HeaderBar />
      <main className="flex-grow h-[calc(100vh-90px)] overflow-y-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-2xl font-semibold text-[#f5f5e8] uppercase tracking-wide mb-1">
                System Health Dashboard
              </h1>
              <p className="text-sm text-[#a9a9a9]">
                Live verification of all connected services
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-[#a9a9a9]">Uptime</div>
                <div className={cn(
                  "text-lg font-bold",
                  uptime >= 80 ? "text-[#00b686]" : uptime >= 50 ? "text-yellow-500" : "text-[#ff4d4d]"
                )}>
                  {uptime}%
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 mt-4">
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
              onClick={runChecks}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#181818] text-[#f5f5e8] border border-[#222] hover:border-[#3a3a3a] transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={cn(loading && "animate-spin")} />
              Run Full Diagnostics
            </button>
            
              <button
                onClick={exportReport}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#181818] text-[#f5f5e8] border border-[#222] hover:border-[#3a3a3a] transition-colors"
              >
                <Download size={16} />
                Export Report
              </button>
              
            <div className="ml-auto text-xs text-[#a9a9a9]">
              Last checked: {formatTime(lastChecked)}
            </div>
          </div>
          
          <TradingLoopControl />
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {results.map((result) => {
            const history = latencyHistory.get(result.service);
            const chartData = history?.data || [];

            return (
              <div
                key={result.service}
                className={cn(
                  "bg-[#181818] border p-4 transition-all",
                  getStatusColor(result.status)
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{getStatusBadge(result.status)}</span>
                      <h3 className="text-sm font-semibold text-[#f5f5e8]">
                        {result.service}
                      </h3>
                    </div>
                    <p className="text-xs text-[#a9a9a9] mb-2">{result.message}</p>
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-xs font-medium",
                        getLatencyColor(result.latency)
                      )}>
                        {result.latency}ms
                      </span>
                      <button
                        onClick={() => retryCheck(result.service)}
                        className="text-xs text-[#a9a9a9] hover:text-[#f5f5e8] transition-colors"
                      >
                        Retry
                      </button>
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
                          stroke={result.status === 'ok' ? '#00b686' : result.status === 'warning' ? '#fbbf24' : '#ff4d4d'}
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
                {result.details && (
                  <div className="mt-2 pt-2 border-t border-[#222] text-xs text-[#a9a9a9]">
                    {Object.entries(result.details).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span>{key}:</span>
                        <span className="text-[#f5f5e8]">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {loading && results.length === 0 && (
          <div className="flex items-center justify-center h-64 text-[#a9a9a9]">
            <RefreshCw className="animate-spin mr-2" size={20} />
            Running initial health checks...
          </div>
        )}
      </main>
    </div>
  );
}


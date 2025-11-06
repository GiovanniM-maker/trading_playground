'use client';

import { useEffect, useState } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { cn } from '@/lib/utils';
import { RefreshCw, X, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'OK' | 'ERROR' | 'WARNING';
  latency: number;
  code?: number;
  json?: any;
  error?: string;
  lastUpdate?: string;
}

interface SystemStatus {
  timestamp: string;
  total_latency: number;
  services: ServiceStatus[];
}

export default function ServerDashboard() {
  const [data, setData] = useState<SystemStatus | null>(null);
  const [selected, setSelected] = useState<ServiceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  async function fetchStatus() {
    try {
      setLoading(true);
      const res = await fetch('/api/system/status');
      if (!res.ok) throw new Error('Failed to fetch status');
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Error fetching status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRestart() {
    if (!confirm('Are you sure you want to clear cache and restart services?')) {
      return;
    }

    setRefreshing(true);
    try {
      const res = await fetch('/api/system/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear-cache' }),
      });

      if (!res.ok) throw new Error('Failed to restart');
      
      const result = await res.json();
      alert(`Success: ${result.message}\nActions: ${result.actions?.join('\n') || 'None'}`);
      
      // Refresh status after restart
      setTimeout(() => fetchStatus(), 1000);
    } catch (error) {
      console.error('Error restarting:', error);
      alert('Failed to restart services');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    
    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 60000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OK':
        return <CheckCircle2 size={20} className="text-[#00b686]" />;
      case 'WARNING':
        return <AlertCircle size={20} className="text-yellow-500" />;
      case 'ERROR':
        return <AlertCircle size={20} className="text-[#ff4d4d]" />;
      default:
        return <Clock size={20} className="text-[#a9a9a9]" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OK':
        return 'border-[#00b686]/50 bg-[#00b686]/5';
      case 'WARNING':
        return 'border-yellow-500/50 bg-yellow-500/5';
      case 'ERROR':
        return 'border-[#ff4d4d]/50 bg-[#ff4d4d]/5';
      default:
        return 'border-[#222] bg-[#181818]';
    }
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 200) return 'text-[#00b686]';
    if (latency < 500) return 'text-yellow-500';
    return 'text-[#ff4d4d]';
  };

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="flex flex-col w-full h-screen bg-[#0c0c0d] text-[#f5f5e8] overflow-hidden">
      <HeaderBar />
      <main className="flex-grow h-[calc(100vh-90px)] flex overflow-hidden">
        {/* Main Content */}
        <div className={cn(
          "flex-1 flex flex-col transition-all duration-300",
          selected ? "mr-[35%]" : "mr-0"
        )}>
          {/* Header */}
          <div className="p-6 border-b border-[#222] bg-[#141414]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-semibold text-[#f5f5e8] uppercase tracking-wide mb-1">
                  Server Monitoring Dashboard
                </h1>
                <p className="text-sm text-[#a9a9a9]">
                  Real-time health and performance monitoring for all backend services
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border",
                    autoRefresh
                      ? "bg-[#181818] text-[#f5f5e8] border-[#3a3a3a]"
                      : "bg-[#141414] text-[#a9a9a9] border-[#222] hover:text-[#f5f5e8]"
                  )}
                >
                  <Clock size={16} className={cn(autoRefresh && "text-[#00b686]")} />
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
                  onClick={handleRestart}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#ff4d4d]/20 text-[#ff4d4d] border border-[#ff4d4d]/30 hover:bg-[#ff4d4d]/30 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={16} className={cn(refreshing && "animate-spin")} />
                  Clear Cache
                </button>
              </div>
            </div>

            {data && (
              <div className="flex items-center gap-6 text-xs text-[#a9a9a9]">
                <span>Last updated: {formatTime(data.timestamp)}</span>
                <span>Total latency: {data.total_latency}ms</span>
                <span>Services checked: {data.services.length}</span>
              </div>
            )}
          </div>

          {/* Services Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading && !data ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="animate-spin text-[#a9a9a9]" size={32} />
              </div>
            ) : data?.services ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.services.map((service) => (
                  <div
                    key={service.name}
                    onClick={() => setSelected(service)}
                    className={cn(
                      "p-4 border rounded-lg cursor-pointer transition-all hover:border-[#3a3a3a]",
                      getStatusColor(service.status)
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(service.status)}
                        <h3 className="text-lg font-semibold text-[#f5f5e8]">
                          {service.name}
                        </h3>
                      </div>
                      {service.code && (
                        <span className="text-xs text-[#a9a9a9] px-2 py-1 bg-[#141414] rounded">
                          {service.code}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[#a9a9a9]">Status:</span>
                        <span className={cn(
                          "font-medium",
                          service.status === 'OK' ? "text-[#00b686]" :
                          service.status === 'WARNING' ? "text-yellow-500" :
                          "text-[#ff4d4d]"
                        )}>
                          {service.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[#a9a9a9]">Latency:</span>
                        <span className={cn("font-medium", getLatencyColor(service.latency))}>
                          {service.latency}ms
                        </span>
                      </div>

                      {service.lastUpdate && (
                        <div className="flex items-center justify-between">
                          <span className="text-[#a9a9a9]">Last update:</span>
                          <span className="text-[#f5f5e8] text-xs">
                            {formatTime(service.lastUpdate)}
                          </span>
                        </div>
                      )}

                      {service.error && (
                        <div className="pt-2 border-t border-[#222]">
                          <span className="text-xs text-[#ff4d4d]">
                            {service.error}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-[#222]">
                      <span className="text-xs text-[#a9a9a9] hover:text-[#f5f5e8] transition-colors">
                        Click to view details →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-[#a9a9a9]">
                No service data available
              </div>
            )}
          </div>
        </div>

        {/* Sidebar for detailed logs */}
        {selected && (
          <div className="w-[35%] bg-[#181818] border-l border-[#222] flex flex-col">
            <div className="p-4 border-b border-[#222] bg-[#141414]">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-[#f5f5e8]">
                  {selected.name} Details
                </h2>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1 hover:bg-[#222] rounded transition-colors"
                >
                  <X size={20} className="text-[#a9a9a9]" />
                </button>
              </div>
              
              <div className="flex items-center gap-4 text-xs text-[#a9a9a9]">
                <span className={cn(
                  "px-2 py-1 rounded",
                  selected.status === 'OK' ? "bg-[#00b686]/20 text-[#00b686]" :
                  selected.status === 'WARNING' ? "bg-yellow-500/20 text-yellow-500" :
                  "bg-[#ff4d4d]/20 text-[#ff4d4d]"
                )}>
                  {selected.status}
                </span>
                <span>Latency: {selected.latency}ms</span>
                {selected.code && <span>HTTP {selected.code}</span>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Error Display */}
              {selected.error && (
                <div className="mb-4 p-3 bg-[#ff4d4d]/10 border border-[#ff4d4d]/30 rounded">
                  <h3 className="text-sm font-semibold text-[#ff4d4d] mb-1">Error</h3>
                  <p className="text-xs text-[#f5f5e8]">{selected.error}</p>
                </div>
              )}

              {/* JSON Response */}
              {selected.json && Object.keys(selected.json).length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-[#f5f5e8] mb-2">Response Data</h3>
                  <pre className="text-xs bg-[#0c0c0d] border border-[#222] rounded p-3 overflow-x-auto text-[#f5f5e8]">
                    {JSON.stringify(selected.json, null, 2)}
                  </pre>
                </div>
              )}

              {/* Performance Metrics */}
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-[#f5f5e8] mb-2">Performance Metrics</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#a9a9a9]">Response Time:</span>
                    <span className={cn("font-medium", getLatencyColor(selected.latency))}>
                      {selected.latency}ms
                    </span>
                  </div>
                  {selected.code && (
                    <div className="flex justify-between">
                      <span className="text-[#a9a9a9]">HTTP Status:</span>
                      <span className="font-medium text-[#f5f5e8]">
                        {selected.code}
                      </span>
                    </div>
                  )}
                  {selected.lastUpdate && (
                    <div className="flex justify-between">
                      <span className="text-[#a9a9a9]">Last Update:</span>
                      <span className="font-medium text-[#f5f5e8]">
                        {new Date(selected.lastUpdate).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Empty State */}
              {!selected.error && (!selected.json || Object.keys(selected.json).length === 0) && (
                <div className="text-center text-[#a9a9a9] py-8">
                  <p>No detailed information available</p>
                  <p className="text-xs mt-2">Service is {selected.status}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}


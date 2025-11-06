'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, RefreshCw, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogEntry {
  timestamp: number;
  status?: 'OK' | 'WARNING' | 'ERROR';
  level?: 'ok' | 'warning' | 'error' | 'info';
  latency?: number;
  message?: string;
  error?: string;
  code?: number;
  time?: number | string;
}

interface LogsModalProps {
  serviceName: string;
  isOpen: boolean;
  onClose: () => void;
}

const LEVEL_COLORS: Record<string, string> = {
  error: "text-red-400 border-red-700 bg-red-950/40",
  warning: "text-yellow-400 border-yellow-700 bg-yellow-950/30",
  info: "text-blue-400 border-blue-700 bg-blue-950/30",
  ok: "text-green-400 border-green-700 bg-green-950/30",
};

export function LogsModal({ serviceName, isOpen, onClose }: LogsModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'ok'>('all');

  // Normalize log level from status or level field
  const getLogLevel = (log: LogEntry): 'error' | 'warning' | 'info' | 'ok' => {
    if (log.level) {
      return log.level.toLowerCase() as 'error' | 'warning' | 'info' | 'ok';
    }
    if (log.status) {
      const status = log.status.toLowerCase();
      if (status === 'error') return 'error';
      if (status === 'warning') return 'warning';
      if (status === 'ok') return 'ok';
    }
    return 'info';
  };

  // Filter logs based on selected filter
  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => {
        const level = getLogLevel(log);
        return level === filter;
      });

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/control/logs?service=${encodeURIComponent(serviceName)}`);
      if (!response.ok) throw new Error('Failed to fetch logs');
      
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [serviceName]);

  const exportLogs = () => {
    const exportData = {
      service: serviceName,
      exportedAt: new Date().toISOString(),
      totalLogs: logs.length,
      filteredLogs: filteredLogs.length,
      logs: filteredLogs,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${serviceName.toLowerCase().replace(/\s+/g, '-')}-logs-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  useEffect(() => {
    if (!isOpen || !autoRefresh) return;

    const interval = setInterval(() => {
      fetchLogs();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [isOpen, autoRefresh, fetchLogs]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#0c0c0d] border border-[#222] rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#222]">
          <div>
            <h2 className="text-xl font-semibold text-[#f5f5e8] uppercase tracking-wide">
              {serviceName.toUpperCase()} - LOGS
            </h2>
            <p className="text-sm text-[#a9a9a9] mt-1">
              {filteredLogs.length} of {logs.length} log entries
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'error' | 'warning' | 'ok')}
              className="bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-neutral-300 focus:outline-none focus:border-[#00b686]"
            >
              <option value="all">All</option>
              <option value="ok">OK</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors border",
                autoRefresh
                  ? "bg-[#181818] text-[#00b686] border-[#00b686]/30"
                  : "bg-[#141414] text-[#a9a9a9] border-[#222] hover:text-[#f5f5e8]"
              )}
            >
              <RefreshCw size={14} className={cn(autoRefresh && "animate-spin")} />
              Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-[#181818] text-[#f5f5e8] border border-[#222] hover:border-[#3a3a3a] transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={cn(loading && "animate-spin")} />
              Refresh
            </button>
            <button
              onClick={exportLogs}
              disabled={logs.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-[#181818] text-[#f5f5e8] border border-[#222] hover:border-[#3a3a3a] transition-colors disabled:opacity-50"
            >
              <Download size={14} />
              Export JSON
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[#a9a9a9] hover:text-[#f5f5e8] transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Logs Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-neutral-900">
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-[#a9a9a9]">
              <RefreshCw className="animate-spin mr-2" size={20} />
              Loading logs...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-[#a9a9a9]">
              <p className="text-neutral-500 text-center">
                {logs.length === 0 
                  ? 'No log entries found' 
                  : `No ${filter === 'all' ? '' : filter} log entries found`}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log, index) => {
                const level = getLogLevel(log);
                const color = LEVEL_COLORS[level] || LEVEL_COLORS.info;
                const timestamp = log.time 
                  ? (typeof log.time === 'string' ? new Date(log.time) : new Date(log.time))
                  : new Date(log.timestamp);
                
                return (
                  <div
                    key={index}
                    className={cn(
                      "border rounded-lg mb-2 px-4 py-2 flex justify-between items-center",
                      color
                    )}
                  >
                    <div className="text-sm font-mono whitespace-pre-wrap flex-1 min-w-0">
                      <span className="font-semibold">
                        [{level.toUpperCase()}]
                      </span>
                      {' '}
                      <span className="text-[#f5f5e8]">
                        {log.message || log.error || 'No message'}
                      </span>
                      {log.code && (
                        <span className="ml-2 text-xs text-neutral-400">
                          • HTTP {log.code}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-400 flex-shrink-0 ml-4">
                      {timestamp.toLocaleTimeString()}
                      {log.latency ? ` • ${log.latency}ms` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#222] bg-[#141414]">
          <div className="flex items-center justify-between text-xs text-[#a9a9a9]">
            <div className="flex items-center gap-4">
              <span>Total: {logs.length} entries</span>
              {filter !== 'all' && (
                <span className="text-yellow-500">
                  Filtered: {filteredLogs.length} {filter} entries
                </span>
              )}
            </div>
            <span>Press ESC or click outside to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}


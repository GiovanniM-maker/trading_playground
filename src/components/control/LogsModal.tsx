'use client';

import { useEffect, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogEntry {
  timestamp: number;
  status: 'OK' | 'WARNING' | 'ERROR';
  latency?: number;
  message: string;
  code?: number;
}

interface LogsModalProps {
  serviceName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function LogsModal({ serviceName, isOpen, onClose }: LogsModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = async () => {
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
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, serviceName]);

  useEffect(() => {
    if (!isOpen || !autoRefresh) return;

    const interval = setInterval(() => {
      fetchLogs();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [isOpen, autoRefresh, serviceName]);

  if (!isOpen) return null;

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getLogLevel = (status: string): 'INFO' | 'WARNING' | 'ERROR' => {
    if (status === 'ERROR' || status === 'error') return 'ERROR';
    if (status === 'WARNING' || status === 'warning') return 'WARNING';
    return 'INFO';
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'text-[#ff4d4d] border-[#ff4d4d]/30 bg-[#ff4d4d]/10';
      case 'WARNING':
        return 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10';
      default:
        return 'text-[#00b686] border-[#00b686]/30 bg-[#00b686]/10';
    }
  };

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
              {serviceName} - Logs
            </h2>
            <p className="text-sm text-[#a9a9a9] mt-1">
              Last 50 log entries
            </p>
          </div>
          <div className="flex items-center gap-3">
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
              onClick={onClose}
              className="p-2 text-[#a9a9a9] hover:text-[#f5f5e8] transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Logs Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-[#a9a9a9]">
              <RefreshCw className="animate-spin mr-2" size={20} />
              Loading logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-[#a9a9a9]">
              No logs available for this service
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log, index) => {
                const level = getLogLevel(log.status);
                return (
                  <div
                    key={index}
                    className={cn(
                      "p-3 border rounded-lg text-sm",
                      getLogColor(level)
                    )}
                  >
                    <div className="flex items-start justify-between gap-4 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide">
                          [{level}]
                        </span>
                        {log.code && (
                          <span className="text-xs text-[#a9a9a9] px-1.5 py-0.5 bg-[#141414] rounded">
                            HTTP {log.code}
                          </span>
                        )}
                        {log.latency && (
                          <span className="text-xs text-[#a9a9a9]">
                            {log.latency}ms
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[#a9a9a9] flex-shrink-0">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-[#f5f5e8] text-sm break-words">
                      {log.message}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#222] bg-[#141414]">
          <div className="flex items-center justify-between text-xs text-[#a9a9a9]">
            <span>Total: {logs.length} entries</span>
            <span>Press ESC or click outside to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}


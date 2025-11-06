'use client';

import { LogEntry } from '@/lib/control/logs';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface LogViewerProps {
  logs: LogEntry[];
}

export function LogViewer({ logs }: LogViewerProps) {
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getLogIcon = (status?: string) => {
    switch (status) {
      case 'OK':
        return <CheckCircle2 size={14} className="text-[#00b686]" />;
      case 'WARNING':
        return <AlertTriangle size={14} className="text-yellow-500" />;
      case 'ERROR':
        return <XCircle size={14} className="text-[#ff4d4d]" />;
      default:
        return null;
    }
  };

  const getLogColor = (status?: string) => {
    switch (status) {
      case 'OK':
        return 'border-l-[#00b686] bg-[#00b686]/5';
      case 'WARNING':
        return 'border-l-yellow-500 bg-yellow-500/5';
      case 'ERROR':
        return 'border-l-[#ff4d4d] bg-[#ff4d4d]/5';
      default:
        return 'border-l-[#222] bg-[#141414]';
    }
  };

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-[#a9a9a9]">
        <p>No log entries yet</p>
        <p className="text-xs mt-1">Logs will appear here as checks are performed</p>
      </div>
    );
  }

  return (
    <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 scrollbar-thin">
      {logs.map((log, index) => (
        <div
          key={index}
          className={cn(
            "p-3 border-l-2 rounded-r text-xs",
            getLogColor(log.status || undefined)
          )}
        >
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {getLogIcon(log.status)}
              <span className={cn(
                "font-medium",
                log.status === 'OK' ? "text-[#00b686]" :
                log.status === 'WARNING' ? "text-yellow-500" :
                "text-[#ff4d4d]"
              )}>
                {log.status}
              </span>
              {log.code && (
                <span className="text-[#a9a9a9]">HTTP {log.code}</span>
              )}
              {log.latency && (
                <span className="text-[#a9a9a9]">{log.latency}ms</span>
              )}
            </div>
            <span className="text-[#a9a9a9] text-xs flex-shrink-0 ml-2">
              {formatTimestamp(log.timestamp)}
            </span>
          </div>
          
          {log.message && (
            <p className="text-[#f5f5e8] text-xs mt-1 line-clamp-2">
              {log.message}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}


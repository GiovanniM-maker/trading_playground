'use client';

import { CheckCircle2, XCircle, AlertTriangle, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ServiceCardProps {
  name: string;
  status: 'OK' | 'ERROR' | 'WARNING';
  latency: number;
  http?: number;
  onClick: () => void;
  logsCount?: number;
  lastUpdate?: string;
  errorCount?: number;
  json?: any;
}

export function ServiceCard({
  name,
  status,
  latency,
  http,
  onClick,
  logsCount = 0,
  lastUpdate,
  errorCount = 0,
  json,
}: ServiceCardProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'OK':
        return <CheckCircle2 size={20} className="text-[#00b686]" />;
      case 'WARNING':
        return <AlertTriangle size={20} className="text-yellow-500" />;
      case 'ERROR':
        return <XCircle size={20} className="text-[#ff4d4d]" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'OK':
        return 'border-[#00b686]/50 bg-[#00b686]/5 hover:border-[#00b686]/70 hover:bg-[#00b686]/10';
      case 'WARNING':
        return 'border-yellow-500/50 bg-yellow-500/5 hover:border-yellow-500/70 hover:bg-yellow-500/10';
      case 'ERROR':
        return 'border-[#ff4d4d]/50 bg-[#ff4d4d]/5 hover:border-[#ff4d4d]/70 hover:bg-[#ff4d4d]/10';
    }
  };

  const getLatencyColor = (latencyValue?: number) => {
    const lat = latencyValue ?? latency;
    if (lat < 200) return 'text-[#00b686]';
    if (lat < 500) return 'text-yellow-500';
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

  const isSentimentSystem = name === 'Sentiment System' || name === 'Hugging Face';
  const isDisabled = isSentimentSystem && json?.status === 'DISABLED';
  
  return (
    <div
      onClick={onClick}
      className={cn(
        "p-4 border rounded-xl cursor-pointer transition-all min-h-[180px] flex flex-col",
        getStatusColor(),
        isDisabled && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isSentimentSystem ? (
            // Show emoji status for Sentiment System
            <span className="text-lg">
              {json?.status === 'DISABLED' ? '⚪' :
               json?.status === 'OK' || status === 'OK' ? '🟢' :
               json?.status === 'AUTH_ERROR' || (json?.status && json.status !== 'OK' && status === 'ERROR') ? '🟡' :
               status === 'ERROR' ? '🔴' : '🟡'}
            </span>
          ) : (
            getStatusIcon()
          )}
          <h3 className="text-base font-semibold text-[#f5f5e8] truncate">
            {isSentimentSystem && isDisabled ? `${name} (Disabled)` : name}
          </h3>
          {status === 'OK' && (
            <div className="w-2 h-2 rounded-full bg-[#00b686] animate-pulse ml-auto flex-shrink-0" />
          )}
        </div>
        {http && (
          <span className="text-xs text-[#a9a9a9] px-2 py-1 bg-[#141414] rounded flex-shrink-0">
            {http}
          </span>
        )}
      </div>

      <div className="flex-1 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-[#a9a9a9]">Status:</span>
          <span className={cn(
            "font-medium",
            status === 'OK' ? "text-[#00b686]" :
            status === 'WARNING' ? "text-yellow-500" :
            "text-[#ff4d4d]"
          )}>
            {status}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#a9a9a9]">Latency:</span>
          <span className={cn("font-medium", getLatencyColor())}>
            {latency}ms
          </span>
        </div>

        {lastUpdate && (
          <div className="flex items-center justify-between">
            <span className="text-[#a9a9a9]">Updated:</span>
            <span className="text-[#f5f5e8] text-xs truncate ml-2">
              {formatTime(lastUpdate)}
            </span>
          </div>
        )}

        {logsCount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[#a9a9a9]">Logs:</span>
            <span className="text-[#f5f5e8] text-xs">
              {logsCount} entries
            </span>
          </div>
        )}
        {errorCount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[#a9a9a9]">Errors:</span>
            <span className="text-[#ff4d4d] text-xs font-medium">
              {errorCount}
            </span>
          </div>
        )}
        {name === 'News System' && json?.count !== undefined && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[#a9a9a9]">Articles:</span>
              <span className={cn(
                "text-xs font-medium",
                json.count > 0 ? "text-[#00b686]" : "text-[#ff4d4d]"
              )}>
                {json.count}
              </span>
            </div>
            {json.lastUpdate && (
              <div className="flex items-center justify-between">
                <span className="text-[#a9a9a9]">Last Update:</span>
                <span className="text-[#f5f5e8] text-xs truncate" title={json.lastUpdate}>
                  {formatTime(json.lastUpdate)}
                </span>
              </div>
            )}
            {json.cached !== undefined && (
              <div className="flex items-center justify-between pt-2 border-t border-[#222]">
                <span className="text-[#a9a9a9] text-xs">Status:</span>
                <span className="text-xs flex items-center gap-1">
                  {json.cached ? (
                    <>
                      <span>⚠️</span>
                      <span className="text-yellow-500">Cached</span>
                    </>
                  ) : (
                    <>
                      <span>✅</span>
                      <span className="text-[#00b686]">Live</span>
                    </>
                  )}
                </span>
              </div>
            )}
          </>
        )}
        {json?.model && (
          <div className="flex items-center justify-between">
            <span className="text-[#a9a9a9]">Model:</span>
            <span className="text-[#f5f5e8] text-xs truncate" title={json.model}>
              {json.model}
            </span>
          </div>
        )}
        {isSentimentSystem && isDisabled && (
          <div className="flex items-center justify-between pt-2 border-t border-[#222]">
            <span className="text-[#a9a9a9] text-xs">Status:</span>
            <span className="text-[#a9a9a9] text-xs italic">
              Disabled — re-enable by adding HUGGINGFACE_API_KEY
            </span>
          </div>
        )}
        {isSentimentSystem && json?.model && !isDisabled && (
          <div className="flex items-center justify-between">
            <span className="text-[#a9a9a9]">Model:</span>
            <span className="text-[#f5f5e8] text-xs truncate" title={json.model}>
              {json.model}
            </span>
          </div>
        )}
        {isSentimentSystem && json?.source && (
          <div className="flex items-center justify-between pt-2 border-t border-[#222]">
            <span className="text-[#a9a9a9] text-xs">Source:</span>
            <span className="text-xs flex items-center gap-1">
              {json.source === 'huggingface' && (
                <>
                  <span>✅</span>
                  <span className="text-[#00b686]">Online (HuggingFace)</span>
                </>
              )}
              {json.source === 'cached' && (
                <>
                  <span>🕓</span>
                  <span className="text-yellow-500">Using Cached Sentiment</span>
                </>
              )}
              {json.source === 'local-fallback' && (
                <>
                  <span>⚠️</span>
                  <span className="text-yellow-500">Fallback (Local)</span>
                </>
              )}
            </span>
          </div>
        )}
        {json?.latency_ms && (
          <div className="flex items-center justify-between">
            <span className="text-[#a9a9a9]">Last Inference:</span>
            <span className={cn("text-xs font-medium", getLatencyColor(json.latency_ms))}>
              {json.latency_ms}ms
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-[#222]">
        <div className="flex items-center gap-1 text-xs text-[#a9a9a9] hover:text-[#f5f5e8] transition-colors">
          <Activity size={12} />
          <span>Click to view details →</span>
        </div>
      </div>
    </div>
  );
}


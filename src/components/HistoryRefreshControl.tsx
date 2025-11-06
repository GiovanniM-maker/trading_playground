'use client';

import { useState, useEffect } from 'react';
import { Play, Square, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function HistoryRefreshControl() {
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ success: number; failed: number } | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/admin/history-refresh-loop');
      if (response.ok) {
        const data = await response.json();
        setRunning(data.running);
        setLastRefresh(data.lastRefresh);
        setLastResult(data.lastResult);
      }
    } catch (error) {
      console.error('Error fetching history refresh status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/history-refresh-loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: running ? 'stop' : 'start' }),
      });

      if (response.ok) {
        const data = await response.json();
        setRunning(data.running);
        await fetchStatus();
      }
    } catch (error) {
      console.error('Error toggling history refresh loop:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[#181818] border border-[#222] rounded">
      <div className="flex items-center gap-2">
        <RefreshCw 
          size={16} 
          className={cn(
            "text-[#a9a9a9]",
            running && "text-[#00b686] animate-spin"
          )} 
        />
        <span className="text-sm font-medium text-[#f5f5e8]">
          History Refresh
        </span>
      </div>
      
      <div className="flex items-center gap-2 ml-auto">
        <div className="text-xs text-[#a9a9a9]">
          {running ? (
            <span className="text-[#00b686]">● Running</span>
          ) : (
            <span className="text-[#a9a9a9]">○ Stopped</span>
          )}
        </div>
        
        {lastRefresh && (
          <div className="text-xs text-[#a9a9a9]">
            Last: {formatTime(lastRefresh)}
          </div>
        )}
        
        {lastResult && (
          <div className="text-xs text-[#a9a9a9]">
            {lastResult.success}✓ {lastResult.failed > 0 && <span className="text-[#ff4d4d]">{lastResult.failed}✗</span>}
          </div>
        )}
        
        <button
          onClick={handleToggle}
          disabled={loading}
          className={cn(
            "flex items-center gap-1 px-3 py-1 text-xs font-medium rounded transition-colors",
            running
              ? "bg-[#ff4d4d]/20 text-[#ff4d4d] border border-[#ff4d4d]/30 hover:bg-[#ff4d4d]/30"
              : "bg-[#00b686]/20 text-[#00b686] border border-[#00b686]/30 hover:bg-[#00b686]/30",
            loading && "opacity-50 cursor-not-allowed"
          )}
        >
          {running ? (
            <>
              <Square size={12} />
              Stop
            </>
          ) : (
            <>
              <Play size={12} />
              Start
            </>
          )}
        </button>
      </div>
    </div>
  );
}


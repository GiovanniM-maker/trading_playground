'use client';

import { useState, useEffect } from 'react';
import { Play, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TradingLoopControl() {
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/admin/trading-loop');
      if (response.ok) {
        const data = await response.json();
        setRunning(data.running);
      }
    } catch (error) {
      console.error('Error fetching trading loop status:', error);
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
      const response = await fetch('/api/admin/trading-loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: running ? 'stop' : 'start' }),
      });

      if (response.ok) {
        const data = await response.json();
        setRunning(data.running);
      }
    } catch (error) {
      console.error('Error toggling trading loop:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[#181818] border border-[#222] rounded">
      <span className="text-xs text-[#a9a9a9]">Trading Simulator:</span>
      <div className={cn(
        "flex items-center gap-2 px-2 py-1 text-xs",
        running ? "text-[#00b686]" : "text-[#a9a9a9]"
      )}>
        <div className={cn(
          "w-2 h-2 rounded-full",
          running ? "bg-[#00b686] animate-pulse" : "bg-[#a9a9a9]"
        )} />
        <span>{running ? 'Running' : 'Stopped'}</span>
      </div>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={cn(
          "flex items-center gap-1 px-3 py-1 text-xs font-medium transition-colors border",
          running
            ? "bg-[#ff4d4d]/20 text-[#ff4d4d] border-[#ff4d4d]/30 hover:bg-[#ff4d4d]/30"
            : "bg-[#00b686]/20 text-[#00b686] border-[#00b686]/30 hover:bg-[#00b686]/30",
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
  );
}


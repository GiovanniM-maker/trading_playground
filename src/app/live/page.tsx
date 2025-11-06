'use client';

import { useEffect, useState } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { Trade } from '@/lib/db';
import { cn } from '@/lib/utils';

export default function LivePage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrades = async () => {
    try {
      const response = await fetch('/api/trades?limit=200');
      if (!response.ok) throw new Error('Failed to fetch trades');
      
      const data = await response.json();
      setTrades(data.trades || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching trades:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchTrades, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="flex flex-col w-full h-screen bg-[#0c0c0d] text-[#f5f5e8] overflow-hidden">
      <HeaderBar />
      <main className="flex-grow h-[calc(100vh-90px)] flex flex-col p-6 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#f5f5e8] uppercase tracking-wide mb-2">
            📊 Live Trade Stream
          </h1>
          <p className="text-sm text-[#a9a9a9]">
            Real-time trading activity across all AI models
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-[#a9a9a9]">
            Loading trades...
          </div>
        ) : (
          <div className="bg-[#181818] border border-[#222] overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#141414] border-b border-[#222]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">
                    Model
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">
                    Symbol
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">
                    Side
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">
                    Quantity
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">
                    Price
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">
                    P/L
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {trades.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-[#a9a9a9]">
                      No trades available
                    </td>
                  </tr>
                ) : (
                  trades.map((trade) => (
                    <tr
                      key={trade.id}
                      className="border-b border-[#222] hover:bg-[#141414] transition-colors"
                    >
                      <td className="px-4 py-3 text-[#f5f5e8]">
                        {formatTime(trade.timestamp)}
                      </td>
                      <td className="px-4 py-3 text-[#f5f5e8]">
                        {trade.model}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#f5f5e8]">
                        {trade.symbol}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-1 text-xs font-medium",
                          trade.side === 'buy'
                            ? "bg-[#00b686]/20 text-[#00b686]"
                            : "bg-[#ff4d4d]/20 text-[#ff4d4d]"
                        )}>
                          {trade.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[#f5f5e8]">
                        {trade.qty.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-[#f5f5e8]">
                        ${trade.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={cn(
                        "px-4 py-3 text-right font-semibold",
                        trade.pnl >= 0 ? "text-[#00b686]" : "text-[#ff4d4d]"
                      )}>
                        {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          "px-2 py-1 text-xs font-medium",
                          trade.status === 'open'
                            ? "bg-yellow-500/20 text-yellow-500"
                            : "bg-[#8A8A8A]/20 text-[#8A8A8A]"
                        )}>
                          {trade.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}


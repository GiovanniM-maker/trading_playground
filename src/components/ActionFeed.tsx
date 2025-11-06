'use client';

import { useSimulationStore } from '@/store/useSimulationStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export function ActionFeed() {
  const completedTrades = useSimulationStore((state) => state.completedTrades);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="h-full flex flex-col bg-[#0b0c10]">
      <div className="p-4 border-b border-white/8">
        <h2 className="text-sm font-semibold text-white">Recent Trades</h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {completedTrades.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-sm">
              No trades yet
            </div>
          ) : (
            completedTrades.slice(0, 20).map((trade) => {
              const pnlColor = trade.pnl >= 0 ? 'text-green-400' : 'text-red-400';
              
              return (
                <div
                  key={trade.id}
                  className="border border-white/8 rounded-lg p-3 bg-[#111] hover:bg-[#1a1a1a] transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{trade.modelIcon}</span>
                    <span className="text-xs font-medium text-white">{trade.modelName}</span>
                  </div>
                  <div className="text-xs text-gray-400 mb-1">
                    {trade.side === 'long' ? 'Long' : 'Short'} {trade.coin}
                  </div>
                  <div className="text-xs text-gray-300 mb-1">
                    ${trade.entryPrice.toFixed(2)} → ${trade.exitPrice.toFixed(2)}
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-400">{formatTime(trade.timestamp)}</span>
                    <span className={`text-xs font-semibold ${pnlColor}`}>
                      {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

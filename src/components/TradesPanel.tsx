'use client';

import { useSimulationStore } from '@/store/useSimulationStore';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TradesPanelProps {
  onCollapse: () => void;
}

export function TradesPanel({ onCollapse }: TradesPanelProps) {
  const completedTrades = useSimulationStore((state) => state.completedTrades);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="h-full flex flex-col bg-[var(--panel-bg)]">
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)] flex-shrink-0 relative">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">Recent Trades</h2>
        <button
          onClick={onCollapse}
          className="absolute top-3 right-3 p-1 hover:bg-[var(--background-alt)] transition-colors"
          aria-label="Collapse trades panel"
        >
          <ChevronRight size={18} className="text-[var(--text-muted)]" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        <div className="space-y-2">
          {completedTrades.length === 0 ? (
            <div className="text-center text-[var(--text-muted)] py-8 text-xs">
              No trades yet
            </div>
          ) : (
            completedTrades.slice(0, 30).map((trade) => {
              const pnlColor = trade.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]';
              
              return (
                <div
                  key={trade.id}
                  className="bg-[var(--background-alt)] border border-[var(--border-color)] p-2 hover:border-[#3a3a3a] transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{trade.modelIcon}</span>
                    <span className="text-xs font-medium text-[var(--text-primary)]">{trade.modelName}</span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mb-1">
                    {trade.side === 'long' ? 'Long' : 'Short'} {trade.coin}
                  </div>
                  <div className="text-xs text-[var(--text-primary)] mb-1">
                    ${trade.entryPrice.toFixed(2)} → ${trade.exitPrice.toFixed(2)}
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-[var(--border-color)]">
                    <span className="text-xs text-[var(--text-muted)]">{formatTime(trade.timestamp)}</span>
                    <span className={cn("text-xs font-semibold", pnlColor)}>
                      {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

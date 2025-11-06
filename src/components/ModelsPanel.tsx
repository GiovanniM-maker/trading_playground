'use client';

import { useSimulationStore } from '@/store/useSimulationStore';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModelsPanelProps {
  onCollapse: () => void;
}

export function ModelsPanel({ onCollapse }: ModelsPanelProps) {
  const models = useSimulationStore((state) => state.models);

  return (
    <div className="h-full flex flex-col bg-[var(--panel-bg)]">
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)] flex-shrink-0 relative">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">Models</h2>
        <button
          onClick={onCollapse}
          className="absolute top-3 right-3 p-1 hover:bg-[var(--background-alt)] transition-colors"
          aria-label="Collapse models panel"
        >
          <ChevronLeft size={18} className="text-[var(--text-muted)]" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        <div className="space-y-2">
          {models.map((model) => {
            const isPositive = model.returnPercent >= 0;
            
            return (
              <div
                key={model.id}
                className="bg-[var(--background-alt)] border border-[var(--border-color)] p-3 hover:border-[#3a3a3a] transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{model.icon}</span>
                  <span className="text-sm font-medium text-[var(--text-primary)]" style={{ color: model.color }}>
                    {model.name}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-[var(--text-muted)]">Value:</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    ${model.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-[var(--text-muted)]">Return:</span>
                  <span className={cn(
                    "text-xs font-semibold",
                    isPositive ? "text-[var(--success)]" : "text-[var(--danger)]"
                  )}>
                    {isPositive ? '+' : ''}{model.returnPercent.toFixed(2)}%
                  </span>
                </div>
                <div className="pt-2 mt-2 border-t border-[var(--border-color)]">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[var(--text-muted)]">Trades:</span>
                    <span className="text-[var(--text-primary)]">{model.totalTrades}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

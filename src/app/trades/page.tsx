'use client';

import { useEffect, useState } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { useSimulationStore } from '@/store/useSimulationStore';
import { cn } from '@/lib/utils';

export default function TradesPage() {
  const initialize = useSimulationStore((state) => state.initialize);
  const models = useSimulationStore((state) => state.models);
  const completedTrades = useSimulationStore((state) => state.completedTrades);
  const isPlaying = useSimulationStore((state) => state.isPlaying);
  const speed = useSimulationStore((state) => state.speed);
  const updateSimulation = useSimulationStore((state) => state.updateSimulation);
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [tradeLimit, setTradeLimit] = useState(50);

  useEffect(() => {
    if (models.length === 0) {
      initialize();
    }
  }, [initialize, models.length]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      updateSimulation();
    }, 3000 / speed);
    return () => clearInterval(interval);
  }, [isPlaying, speed, updateSimulation]);

  const filteredTrades = completedTrades.filter(trade => 
    selectedModel === 'all' || trade.modelId === selectedModel
  ).slice(0, tradeLimit);

  return (
    <div className="min-h-screen bg-[#101010] text-[#f1efe7]">
      <HeaderBar />
      <main className="pt-[100px] p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-lg font-semibold text-[#f1efe7] uppercase tracking-wide">Completed Trades</h1>
            <div className="flex gap-2">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-[#181818] border border-[#2a2a2a] px-3 py-2 text-xs text-[#f1efe7] focus:outline-none focus:border-[#3a3a3a]"
              >
                <option value="all">All Models</option>
                {models.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.icon} {model.name}
                  </option>
                ))}
              </select>
              <select
                value={tradeLimit}
                onChange={(e) => setTradeLimit(Number(e.target.value))}
                className="bg-[#181818] border border-[#2a2a2a] px-3 py-2 text-xs text-[#f1efe7] focus:outline-none focus:border-[#3a3a3a]"
              >
                <option value={25}>Last 25</option>
                <option value={50}>Last 50</option>
                <option value={100}>Last 100</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            {filteredTrades.length === 0 ? (
              <div className="text-center text-[#a9a9a9] py-12 text-sm">
                No completed trades yet
              </div>
            ) : (
              filteredTrades.map((trade) => {
                const pnlColor = trade.pnl >= 0 ? 'text-[#27ae60]' : 'text-[#e74c3c]';
                const pnlBg = trade.pnl >= 0 ? 'bg-[#27ae60]/10' : 'bg-[#e74c3c]/10';
                
                return (
                  <div
                    key={trade.id}
                    className="bg-[#181818] border border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <span className="text-xl">{trade.modelIcon}</span>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-[#f1efe7]">{trade.modelName}</span>
                              <span className="text-xs text-[#a9a9a9]">completed a</span>
                              <span className={cn(
                                "text-xs font-medium px-2 py-0.5",
                                trade.side === 'long' ? 'bg-[#27ae60]/20 text-[#27ae60]' : 'bg-[#e74c3c]/20 text-[#e74c3c]'
                              )}>
                                {trade.side === 'long' ? 'LONG' : 'SHORT'}
                              </span>
                              <span className="text-xs text-[#a9a9a9]">trade on</span>
                              <span className="text-xs font-medium text-[#f1efe7]">{trade.coin}</span>
                            </div>
                            <div className="text-xs text-[#a9a9a9] mb-2">
                              Price: <span className="text-[#f1efe7]">${trade.entryPrice.toFixed(2)}</span> → <span className="text-[#f1efe7]">${trade.exitPrice.toFixed(2)}</span>
                            </div>
                            <div className="text-xs text-[#a9a9a9]">
                              Quantity: <span className="text-[#f1efe7]">{trade.quantity.toFixed(4)}</span> • Holding time: <span className="text-[#f1efe7]">{trade.holdingTime}</span>
                            </div>
                          </div>
                        </div>
                        <div className={cn("px-4 py-2", pnlBg)}>
                          <div className="text-xs text-[#a9a9a9] mb-1">NET P&L</div>
                          <div className={cn("text-lg font-bold", pnlColor)}>
                            {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

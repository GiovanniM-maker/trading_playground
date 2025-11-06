'use client';

import { useEffect } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { useSimulationStore } from '@/store/useSimulationStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function PositionsPage() {
  const initialize = useSimulationStore((state) => state.initialize);
  const models = useSimulationStore((state) => state.models);
  const isPlaying = useSimulationStore((state) => state.isPlaying);
  const speed = useSimulationStore((state) => state.speed);
  const updateSimulation = useSimulationStore((state) => state.updateSimulation);

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

  return (
    <div className="min-h-screen bg-[#101010] text-[#f1efe7]">
      <HeaderBar />
      <main className="pt-[100px] p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-lg font-semibold mb-6 text-[#f1efe7] uppercase tracking-wide">Open Positions</h1>
          
          <div className="space-y-4">
            {models.map((model) => {
              const totalUnrealizedPnL = model.openPositions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
              
              return (
                <div key={model.id} className="bg-[#181818] border border-[#2a2a2a]">
                  <div className="p-4 border-b border-[#2a2a2a]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{model.icon}</span>
                        <div>
                          <div className="text-base font-semibold text-[#f1efe7]" style={{ color: model.color }}>
                            {model.name}
                          </div>
                          <div className="text-xs text-[#a9a9a9] mt-1">
                            {model.openPositions.length} open position{model.openPositions.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-[#a9a9a9] mb-1">Total Unrealized P&L</div>
                        <div className={cn(
                          "text-xl font-bold",
                          totalUnrealizedPnL >= 0 ? 'text-[#27ae60]' : 'text-[#e74c3c]'
                        )}>
                          {totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    {model.openPositions.length === 0 ? (
                      <div className="p-6 text-center text-[#a9a9a9] text-sm">
                        No open positions
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-[#2a2a2a]">
                              <th className="text-left p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">SIDE</th>
                              <th className="text-left p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">COIN</th>
                              <th className="text-right p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">LEVERAGE</th>
                              <th className="text-right p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">NOTIONAL</th>
                              <th className="text-right p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">UNREAL P&L</th>
                              <th className="text-right p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">ACTION</th>
                            </tr>
                          </thead>
                          <tbody>
                            {model.openPositions.map((position) => (
                              <tr
                                key={position.id}
                                className="border-b border-[#2a2a2a] hover:bg-[#141414] transition-colors"
                              >
                                <td className="p-4">
                                  <span className={cn(
                                    "text-xs font-medium px-2 py-1",
                                    position.side === 'long' 
                                      ? 'bg-[#27ae60]/20 text-[#27ae60]' 
                                      : 'bg-[#e74c3c]/20 text-[#e74c3c]'
                                  )}>
                                    {position.side.toUpperCase()}
                                  </span>
                                </td>
                                <td className="p-4 text-sm font-medium text-[#f1efe7]">{position.coin}</td>
                                <td className="p-4 text-right text-sm text-[#a9a9a9]">x{position.leverage}</td>
                                <td className="p-4 text-right text-sm text-[#a9a9a9]">
                                  ${position.notional.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className={cn(
                                  "p-4 text-right text-sm font-medium",
                                  position.unrealizedPnL >= 0 ? 'text-[#27ae60]' : 'text-[#e74c3c]'
                                )}>
                                  {position.unrealizedPnL >= 0 ? '+' : ''}${position.unrealizedPnL.toFixed(2)}
                                </td>
                                <td className="p-4 text-right">
                                  <button className="px-3 py-1 text-xs font-medium bg-[#141414] hover:bg-[#1a1a1a] border border-[#2a2a2a] text-[#f1efe7] transition-colors">
                                    VIEW
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

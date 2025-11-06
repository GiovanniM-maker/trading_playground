'use client';

import { useEffect, useState, useCallback } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { useSimulationStore } from '@/store/useSimulationStore';
import { cn } from '@/lib/utils';

interface Position {
  coin: string;
  side: 'LONG' | 'SHORT';
  leverage: number;
  entry: number;
  current: number;
  unrealized_pnl: number;
  date: string;
}

interface PortfolioData {
  model: string;
  total_equity: number;
  available_cash: number;
  unrealized_pnl: number;
  positions: Position[];
}

export default function PortfolioPage() {
  const models = useSimulationStore((state) => state.models);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      // Match model name to portfolio model name
      const firstModel = models[0];
      setSelectedModel(firstModel.name);
    }
  }, [models, selectedModel]);

  const fetchPortfolio = useCallback(async () => {
    if (!selectedModel) return;
    
    try {
      setError(null);
      const response = await fetch(`/api/portfolio?modelId=${encodeURIComponent(selectedModel)}`);
      if (!response.ok) throw new Error('Failed to fetch portfolio');
      
      const data = await response.json();
      setPortfolio(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching portfolio:', err);
      setError('Failed to load portfolio data.');
      setLoading(false);
    }
  }, [selectedModel]);

  useEffect(() => {
    if (selectedModel) {
      fetchPortfolio();
      const interval = setInterval(fetchPortfolio, 10000); // Update every 10 seconds
      return () => clearInterval(interval);
    }
  }, [selectedModel, fetchPortfolio]);

  return (
    <div className="flex flex-col w-full h-screen bg-[#0c0c0d] text-[#f5f5e8] overflow-hidden">
      <HeaderBar />
      <main className="flex-grow h-[calc(100vh-90px)] flex flex-col p-6 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#f5f5e8] uppercase tracking-wide mb-4">
            💼 Model Portfolios
          </h1>
          {error && (
            <div className="text-xs text-yellow-500 mb-2">
              ⚠️ {error}
            </div>
          )}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-[#181818] border border-[#222] px-4 py-2 text-sm text-[#f5f5e8] focus:outline-none focus:border-[#3a3a3a]"
          >
            <option value="">Select a model...</option>
            {models.map(model => (
              <option key={model.id} value={model.name}>
                {model.icon} {model.name}
              </option>
            ))}
          </select>
        </div>

        {loading && selectedModel ? (
          <div className="flex items-center justify-center h-full text-[#a9a9a9]">
            Loading portfolio...
          </div>
        ) : portfolio ? (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-[#181818] border border-[#222] p-4">
                <div className="text-xs text-[#a9a9a9] mb-1">Total Equity</div>
                <div className="text-xl font-semibold text-[#f5f5e8]">
                  ${portfolio.total_equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-[#181818] border border-[#222] p-4">
                <div className="text-xs text-[#a9a9a9] mb-1">Available Cash</div>
                <div className="text-xl font-semibold text-[#f5f5e8]">
                  ${portfolio.available_cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-[#181818] border border-[#222] p-4">
                <div className="text-xs text-[#a9a9a9] mb-1">Unrealized P&L</div>
                <div className={cn(
                  "text-xl font-semibold",
                  portfolio.unrealized_pnl >= 0 ? 'text-[#00b686]' : 'text-[#ff4d4d]'
                )}>
                  {portfolio.unrealized_pnl >= 0 ? '+' : ''}${portfolio.unrealized_pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Positions Table */}
            <div className="bg-[#181818] border border-[#222]">
              <div className="p-4 border-b border-[#222]">
                <h2 className="text-sm font-semibold text-[#f5f5e8] uppercase tracking-wide">Open Positions</h2>
              </div>
              {portfolio.positions.length === 0 ? (
                <div className="p-6 text-center text-[#a9a9a9] text-sm">
                  No open positions
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#222]">
                        <th className="text-left p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">Coin</th>
                        <th className="text-left p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">Side</th>
                        <th className="text-right p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">Leverage</th>
                        <th className="text-right p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">Entry</th>
                        <th className="text-right p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">Current</th>
                        <th className="text-right p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">Unrealized P&L</th>
                        <th className="text-right p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.positions.map((position, index) => (
                        <tr key={index} className="border-b border-[#222] hover:bg-[#141414] transition-colors">
                          <td className="p-4 text-sm font-medium text-[#f5f5e8]">{position.coin}</td>
                          <td className="p-4">
                            <span className={cn(
                              "text-xs font-medium px-2 py-1",
                              position.side === 'LONG' 
                                ? 'bg-[#00b686]/20 text-[#00b686] border border-[#00b686]/30' 
                                : 'bg-[#ff4d4d]/20 text-[#ff4d4d] border border-[#ff4d4d]/30'
                            )}>
                              {position.side}
                            </span>
                          </td>
                          <td className="p-4 text-right text-sm text-[#a9a9a9]">x{position.leverage}</td>
                          <td className="p-4 text-right text-sm text-[#f5f5e8]">
                            ${position.entry.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-4 text-right text-sm text-[#f5f5e8]">
                            ${position.current.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className={cn(
                            "p-4 text-right text-sm font-medium",
                            position.unrealized_pnl >= 0 ? 'text-[#00b686]' : 'text-[#ff4d4d]'
                          )}>
                            {position.unrealized_pnl >= 0 ? '+' : ''}${position.unrealized_pnl.toFixed(2)}
                          </td>
                          <td className="p-4 text-right text-xs text-[#a9a9a9]">
                            {new Date(position.date).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : !selectedModel ? (
          <div className="flex items-center justify-center h-full text-[#a9a9a9]">
            Please select a model to view portfolio
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[#a9a9a9]">
            No portfolio data available
          </div>
        )}
      </main>
    </div>
  );
}

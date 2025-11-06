'use client';

import { useEffect, useState, useCallback } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { useSimulationStore } from '@/store/useSimulationStore';
import { Portfolio, Position } from '@/lib/db';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getTrades, Trade } from '@/lib/db';

export default function PortfolioPage() {
  const models = useSimulationStore((state) => state.models);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [closedTrades, setClosedTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    if (!selectedModel) return;
    
    try {
      setError(null);
      const response = await fetch(`/api/portfolio?model=${encodeURIComponent(selectedModel)}`);
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

  const fetchClosedTrades = useCallback(async () => {
    if (!selectedModel) return;
    
    try {
      const response = await fetch(`/api/trades?limit=100`);
      if (!response.ok) throw new Error('Failed to fetch trades');
      
      const data = await response.json();
      const modelTrades = (data.trades || []).filter(
        (trade: Trade) => trade.model === selectedModel && trade.status === 'closed'
      );
      setClosedTrades(modelTrades.slice(0, 50));
    } catch (err) {
      console.error('Error fetching closed trades:', err);
    }
  }, [selectedModel]);

  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      const firstModel = models[0];
      setSelectedModel(firstModel.name);
    }
  }, [models, selectedModel]);

  useEffect(() => {
    if (selectedModel) {
      fetchPortfolio();
      fetchClosedTrades();
      
      const interval = setInterval(() => {
        fetchPortfolio();
        fetchClosedTrades();
      }, 60000); // Update every minute
      
      return () => clearInterval(interval);
    }
  }, [selectedModel, fetchPortfolio, fetchClosedTrades]);

  // Generate equity curve from portfolio balance history (mock for now)
  const equityCurve = portfolio ? [
    { time: 'Day 1', value: portfolio.balance * 0.95 },
    { time: 'Day 2', value: portfolio.balance * 0.97 },
    { time: 'Day 3', value: portfolio.balance * 0.99 },
    { time: 'Day 4', value: portfolio.balance * 1.01 },
    { time: 'Day 5', value: portfolio.balance * 1.02 },
    { time: 'Day 6', value: portfolio.balance * 1.00 },
    { time: 'Day 7', value: portfolio.balance },
  ] : [];

  return (
    <div className="flex flex-col w-full h-screen bg-[#0c0c0d] text-[#f5f5e8] overflow-hidden">
      <HeaderBar />
      <main className="flex-grow h-[calc(100vh-90px)] flex flex-col p-6 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#f5f5e8] uppercase tracking-wide mb-2">
            Model Portfolio
          </h1>
          
          <div className="flex items-center gap-4">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-[#181818] border border-[#222] px-4 py-2 text-sm text-[#f5f5e8] focus:outline-none focus:border-[#3a3a3a]"
            >
              {models.map((model) => (
                <option key={model.id} value={model.name}>
                  {model.name}
                </option>
              ))}
            </select>
            
            {portfolio && (
              <div className="text-xs text-[#a9a9a9]">
                Last updated: {new Date(portfolio.last_update).toLocaleString()}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-[#a9a9a9]">
            Loading portfolio...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64 text-[#ff4d4d]">
            {error}
          </div>
        ) : portfolio ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-[#181818] border border-[#222] p-4">
                <div className="text-xs text-[#a9a9a9] mb-1">Total Balance</div>
                <div className="text-2xl font-bold text-[#f5f5e8]">
                  ${portfolio.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-[#181818] border border-[#222] p-4">
                <div className="text-xs text-[#a9a9a9] mb-1">Total PnL</div>
                <div className={cn(
                  "text-2xl font-bold",
                  portfolio.positions.reduce((sum, p) => sum + p.pnl, 0) >= 0
                    ? "text-[#00b686]"
                    : "text-[#ff4d4d]"
                )}>
                  {portfolio.positions.reduce((sum, p) => sum + p.pnl, 0) >= 0 ? '+' : ''}
                  ${portfolio.positions.reduce((sum, p) => sum + p.pnl, 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-[#181818] border border-[#222] p-4">
                <div className="text-xs text-[#a9a9a9] mb-1">Open Positions</div>
                <div className="text-2xl font-bold text-[#f5f5e8]">
                  {portfolio.positions.length}
                </div>
              </div>
            </div>

            {/* Equity Curve */}
            <div className="bg-[#181818] border border-[#222] p-4 mb-6">
              <h3 className="text-sm font-semibold text-[#f5f5e8] mb-4 uppercase tracking-wide">
                Equity Curve
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={equityCurve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis 
                      dataKey="time" 
                      stroke="#a9a9a9"
                      tick={{ fill: '#a9a9a9', fontSize: 10 }}
                    />
                    <YAxis 
                      stroke="#a9a9a9"
                      tick={{ fill: '#a9a9a9', fontSize: 12 }}
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#181818', 
                        border: '1px solid #222',
                        borderRadius: '4px',
                        color: '#f5f5e8'
                      }}
                      formatter={(value: number) => [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Value']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#00b686"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Current Positions */}
            <div className="bg-[#181818] border border-[#222] mb-6">
              <div className="p-4 border-b border-[#222]">
                <h3 className="text-sm font-semibold text-[#f5f5e8] uppercase tracking-wide">
                  Current Positions
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#141414] border-b border-[#222]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">
                        Symbol
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">
                        Quantity
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">
                        Avg Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">
                        Unrealized PnL
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.positions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-[#a9a9a9]">
                          No open positions
                        </td>
                      </tr>
                    ) : (
                      portfolio.positions.map((position, index) => (
                        <tr key={index} className="border-b border-[#222] hover:bg-[#141414] transition-colors">
                          <td className="px-4 py-3 font-medium text-[#f5f5e8]">
                            {position.symbol}
                          </td>
                          <td className="px-4 py-3 text-right text-[#f5f5e8]">
                            {position.qty.toFixed(4)}
                          </td>
                          <td className="px-4 py-3 text-right text-[#f5f5e8]">
                            ${position.avg_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className={cn(
                            "px-4 py-3 text-right font-semibold",
                            position.pnl >= 0 ? "text-[#00b686]" : "text-[#ff4d4d]"
                          )}>
                            {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Closed Trades */}
            <div className="bg-[#181818] border border-[#222]">
              <div className="p-4 border-b border-[#222]">
                <h3 className="text-sm font-semibold text-[#f5f5e8] uppercase tracking-wide">
                  Recent Closed Trades
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#141414] border-b border-[#222]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">
                        Time
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
                    </tr>
                  </thead>
                  <tbody>
                    {closedTrades.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-[#a9a9a9]">
                          No closed trades
                        </td>
                      </tr>
                    ) : (
                      closedTrades.map((trade) => (
                        <tr key={trade.id} className="border-b border-[#222] hover:bg-[#141414] transition-colors">
                          <td className="px-4 py-3 text-[#f5f5e8]">
                            {new Date(trade.timestamp).toLocaleString()}
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
                            {trade.qty.toFixed(4)}
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
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}

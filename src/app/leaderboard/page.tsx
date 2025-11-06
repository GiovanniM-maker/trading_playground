'use client';

import { useEffect } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { useSimulationStore } from '@/store/useSimulationStore';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

export default function LeaderboardPage() {
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

  const sortedModels = [...models].sort((a, b) => b.currentBalance - a.currentBalance);

  const chartData = sortedModels.map(model => ({
    name: model.name,
    value: model.currentBalance,
    color: model.color,
  }));

  return (
    <div className="min-h-screen bg-[#101010] text-[#f1efe7]">
      <HeaderBar />
      <main className="pt-[100px] p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-lg font-semibold mb-6 text-[#f1efe7] uppercase tracking-wide">Overall Stats</h1>
          
          {/* Table */}
          <div className="bg-[#181818] border border-[#2a2a2a] mb-6 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">Rank</th>
                  <th className="text-left p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">Model</th>
                  <th className="text-right p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">Account Value</th>
                  <th className="text-right p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">Return %</th>
                  <th className="text-right p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">Total PnL</th>
                  <th className="text-right p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">Fees</th>
                  <th className="text-right p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">Win Rate</th>
                  <th className="text-right p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">Biggest Win</th>
                  <th className="text-right p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">Biggest Loss</th>
                  <th className="text-right p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">Sharpe</th>
                  <th className="text-right p-4 text-xs font-semibold text-[#a9a9a9] uppercase tracking-wide">Trades</th>
                </tr>
              </thead>
              <tbody>
                {sortedModels.map((model, index) => (
                  <tr
                    key={model.id}
                    className="border-b border-[#2a2a2a] hover:bg-[#141414] transition-colors"
                  >
                    <td className="p-4 text-sm text-[#f1efe7]">#{index + 1}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{model.icon}</span>
                        <span className="text-sm font-medium text-[#f1efe7]" style={{ color: model.color }}>
                          {model.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-right text-sm font-medium text-[#f1efe7]">
                      ${model.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={cn(
                      "p-4 text-right text-sm font-medium",
                      model.returnPercent >= 0 ? 'text-[#27ae60]' : 'text-[#e74c3c]'
                    )}>
                      {model.returnPercent >= 0 ? '+' : ''}{model.returnPercent.toFixed(2)}%
                    </td>
                    <td className={cn(
                      "p-4 text-right text-sm font-medium",
                      model.totalPnL >= 0 ? 'text-[#27ae60]' : 'text-[#e74c3c]'
                    )}>
                      {model.totalPnL >= 0 ? '+' : ''}${model.totalPnL.toFixed(2)}
                    </td>
                    <td className="p-4 text-right text-sm text-[#a9a9a9]">
                      ${model.fees.toFixed(2)}
                    </td>
                    <td className="p-4 text-right text-sm text-[#a9a9a9]">
                      {model.winRate.toFixed(1)}%
                    </td>
                    <td className="p-4 text-right text-sm text-[#27ae60]">
                      ${model.biggestWin.toFixed(2)}
                    </td>
                    <td className="p-4 text-right text-sm text-[#e74c3c]">
                      ${model.biggestLoss.toFixed(2)}
                    </td>
                    <td className="p-4 text-right text-sm text-[#a9a9a9]">
                      {model.sharpe.toFixed(2)}
                    </td>
                    <td className="p-4 text-right text-sm text-[#a9a9a9]">
                      {model.totalTrades}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bar Chart */}
          <div className="bg-[#181818] border border-[#2a2a2a] p-6">
            <h2 className="text-sm font-semibold mb-4 text-[#f1efe7] uppercase tracking-wide">Account Values Comparison</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis 
                  dataKey="name" 
                  stroke="#a9a9a9"
                  tick={{ fill: '#a9a9a9', fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  axisLine={{ stroke: '#2a2a2a' }}
                />
                <YAxis 
                  stroke="#a9a9a9"
                  tick={{ fill: '#a9a9a9', fontSize: 11 }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  axisLine={{ stroke: '#2a2a2a' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#181818', 
                    border: '1px solid #2a2a2a',
                    color: '#f1efe7'
                  }}
                  labelStyle={{ color: '#a9a9a9' }}
                  formatter={(value: number) => [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Value']}
                />
                <Bar dataKey="value" radius={0}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
}

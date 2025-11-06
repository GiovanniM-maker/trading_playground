'use client';

import { useMemo } from 'react';
import { useSimulationStore } from '@/store/useSimulationStore';
import { Play, Pause, FastForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export function ChartPanel() {
  const models = useSimulationStore((state) => state.models);
  const isPlaying = useSimulationStore((state) => state.isPlaying);
  const speed = useSimulationStore((state) => state.speed);
  const chartMode = useSimulationStore((state) => state.chartMode);
  const togglePlay = useSimulationStore((state) => state.togglePlay);
  const setSpeed = useSimulationStore((state) => state.setSpeed);
  const setChartMode = useSimulationStore((state) => state.setChartMode);

  // Format data for chart - merge all models' equity history
  const mergedData = useMemo(() => {
    if (models.length === 0) return [];
    
    // Get all unique timestamps from all models
    const allTimes = new Set<number>();
    models.forEach(model => {
      model.equityHistory.forEach(point => allTimes.add(point.time));
    });
    
    const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);
    
    // Create data points for each timestamp with all models' values
    return sortedTimes.map(time => {
      const dataPoint: any = {
        time: new Date(time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        timestamp: time,
      };
      
      // Add each model's value at this timestamp
      models.forEach(model => {
        // Find the closest equity point for this timestamp
        const closestPoint = model.equityHistory.reduce((prev, curr) => {
          return Math.abs(curr.time - time) < Math.abs(prev.time - time) ? curr : prev;
        });
        
        if (chartMode === '$') {
          dataPoint[model.id] = closestPoint.value;
        } else {
          const returnPercent = ((closestPoint.value - model.initialBalance) / model.initialBalance) * 100;
          dataPoint[model.id] = returnPercent;
        }
      });
      
      return dataPoint;
    });
  }, [models, chartMode]);

  return (
    <div className="flex flex-col flex-grow h-full bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] flex-shrink-0">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">Model Performance</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-0 bg-[var(--background-alt)] border border-[var(--border-color)]">
            <button
              onClick={() => setChartMode('$')}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                chartMode === '$' 
                  ? "bg-[var(--panel-bg)] text-[var(--text-primary)]" 
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              $
            </button>
            <button
              onClick={() => setChartMode('%')}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors border-l border-[var(--border-color)]",
                chartMode === '%' 
                  ? "bg-[var(--panel-bg)] text-[var(--text-primary)]" 
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              %
            </button>
          </div>
          <button
            onClick={togglePlay}
            className="p-2 hover:bg-[var(--background-alt)] border border-[var(--border-color)] transition-colors"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 text-[var(--text-muted)]" />
            ) : (
              <Play className="h-4 w-4 text-[var(--text-muted)]" />
            )}
          </button>
          <button
            onClick={() => setSpeed(speed === 1 ? 2 : 1)}
            className="px-3 py-2 text-xs font-medium hover:bg-[var(--background-alt)] border border-[var(--border-color)] transition-colors flex items-center gap-1 text-[var(--text-muted)]"
          >
            <FastForward className="h-3 w-3" />
            {speed}x
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-grow h-full min-h-0 p-4">
        {mergedData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mergedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis 
                dataKey="time" 
                stroke="var(--text-muted)"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                interval="preserveStartEnd"
                axisLine={{ stroke: 'var(--border-color)' }}
              />
              <YAxis 
                stroke="var(--text-muted)"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                domain={['auto', 'auto']}
                tickFormatter={(value) => 
                  chartMode === '$' 
                    ? `$${(value / 1000).toFixed(0)}k`
                    : `${value.toFixed(1)}%`
                }
                axisLine={{ stroke: 'var(--border-color)' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--panel-bg)', 
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)'
                }}
                labelStyle={{ color: 'var(--text-muted)' }}
                formatter={(value: number, name: string) => {
                  const model = models.find(m => m.id === name);
                  const displayName = model ? `${model.icon} ${model.name}` : name;
                  if (chartMode === '$') {
                    return [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, displayName];
                  }
                  return [`${value.toFixed(2)}%`, displayName];
                }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
                iconSize={12}
                formatter={(value, entry) => {
                  const model = models.find(m => m.id === value);
                  return model ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      {model.icon} {model.name}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{value}</span>
                  );
                }}
              />
              {models.map((model) => (
                <Line
                  key={model.id}
                  type="monotone"
                  dataKey={model.id}
                  stroke={model.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: model.color }}
                  isAnimationActive={true}
                  animationDuration={300}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

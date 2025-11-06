'use client';

import { useEffect, useMemo } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { useSimulationStore } from '@/store/useSimulationStore';
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

export default function ObserverPage() {
  const initialize = useSimulationStore((state) => state.initialize);
  const models = useSimulationStore((state) => state.models);
  const updateSimulation = useSimulationStore((state) => state.updateSimulation);

  // Initialize models if not already done
  useEffect(() => {
    if (models.length === 0) {
      initialize();
    }
  }, [initialize, models.length]);

  // Simulate live updates every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      updateSimulation();
    }, 3000);

    return () => clearInterval(interval);
  }, [updateSimulation]);

  // Format data for chart - merge all models' equity history
  const mergedData = useMemo(() => {
    if (models.length === 0) return [];
    
    // Get all unique timestamps from all models
    const allTimes = new Set<number>();
    models.forEach(model => {
      model.equityHistory.forEach(point => allTimes.add(point.time));
    });
    
    const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);
    
    // Keep only last 30 data points
    const recentTimes = sortedTimes.slice(-30);
    
    // Create data points for each timestamp with all models' values
    return recentTimes.map(time => {
      const dataPoint: any = {
        time: new Date(time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        timestamp: time,
      };
      
      // Add each model's value at this timestamp
      models.forEach(model => {
        // Find the closest equity point for this timestamp
        const closestPoint = model.equityHistory.reduce((prev, curr) => {
          return Math.abs(curr.time - time) < Math.abs(prev.time - time) ? curr : prev;
        });
        
        dataPoint[model.id] = closestPoint.value;
      });
      
      return dataPoint;
    });
  }, [models]);

  return (
    <div className="flex flex-col w-full h-screen bg-[var(--background)] text-[var(--text-primary)] overflow-hidden">
      <HeaderBar />
      <main className="flex-grow h-[calc(100vh-90px)] flex flex-col p-6 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] uppercase tracking-wide">
            📊 Live Data Observer
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Real-time visualization of all model equity performance
          </p>
        </div>

        <div className="flex-grow h-full min-h-[600px] bg-[var(--panel-bg)] border border-[var(--border-color)] p-4">
          {mergedData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
              Loading data...
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
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
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
                    return [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, displayName];
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
      </main>
    </div>
  );
}


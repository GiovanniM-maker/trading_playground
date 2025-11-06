'use client';

import { useMemo } from 'react';
import { useSimulationStore } from '@/store/useSimulationStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, FastForward } from 'lucide-react';
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

export function MultiModelChart() {
  const models = useSimulationStore((state) => state.models);
  const isPlaying = useSimulationStore((state) => state.isPlaying);
  const speed = useSimulationStore((state) => state.speed);
  const chartMode = useSimulationStore((state) => state.chartMode);
  const togglePlay = useSimulationStore((state) => state.togglePlay);
  const setSpeed = useSimulationStore((state) => state.setSpeed);
  const setChartMode = useSimulationStore((state) => state.setChartMode);

  // Format data for chart
  const chartData = useMemo(() => {
    if (models.length === 0) return [];
    
    // Get all unique timestamps
    const allTimes = new Set<number>();
    models.forEach(model => {
      model.equityHistory.forEach(point => allTimes.add(point.time));
    });
    
    const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);
    
    // Create data points for each timestamp
    return sortedTimes.map(time => {
      const dataPoint: any = {
        time: new Date(time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        timestamp: time,
      };
      
      models.forEach(model => {
        // Find the closest equity value for this time
        const closestPoint = model.equityHistory.reduce((prev, curr) => {
          return Math.abs(curr.time - time) < Math.abs(prev.time - time) ? curr : prev;
        });
        
        if (chartMode === '$') {
          dataPoint[model.name] = closestPoint.value;
        } else {
          const returnPercent = ((closestPoint.value - model.initialBalance) / model.initialBalance) * 100;
          dataPoint[model.name] = returnPercent;
        }
      });
      
      return dataPoint;
    });
  }, [models, chartMode]);

  return (
    <Card className="h-full flex flex-col bg-[#0b0c10] border-white/8">
      <CardHeader className="pb-3 border-b border-white/8">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-semibold text-white">Model Performance</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-white/5 rounded-md p-1">
              <Button
                variant={chartMode === '$' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChartMode('$')}
                className="h-7 px-3 text-xs"
              >
                $
              </Button>
              <Button
                variant={chartMode === '%' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChartMode('%')}
                className="h-7 px-3 text-xs"
              >
                %
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={togglePlay}
              className="border-white/8"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSpeed(speed === 1 ? 2 : 1)}
              className="border-white/8"
            >
              <FastForward className="h-4 w-4 mr-1" />
              {speed}x
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-4">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="time" 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                domain={['auto', 'auto']}
                tickFormatter={(value) => 
                  chartMode === '$' 
                    ? `$${(value / 1000).toFixed(0)}k`
                    : `${value.toFixed(1)}%`
                }
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1a1b1e', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#e5e5e5'
                }}
                formatter={(value: number, name: string) => {
                  if (chartMode === '$') {
                    return [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name];
                  }
                  return [`${value.toFixed(2)}%`, name];
                }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
              {models.map((model) => (
                <Line
                  key={model.id}
                  type="monotone"
                  dataKey={model.name}
                  stroke={model.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: model.color }}
                  animationDuration={300}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}


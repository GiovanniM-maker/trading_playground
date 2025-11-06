'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface SentimentLogEntry {
  id: string;
  text: string;
  label: 'positive' | 'neutral' | 'negative';
  score: number;
  timestamp: number;
}

interface SentimentStats {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  avgScore: number;
}

export function SentimentMonitor() {
  const [logs, setLogs] = useState<SentimentLogEntry[]>([]);
  const [stats, setStats] = useState<SentimentStats>({
    total: 0,
    positive: 0,
    negative: 0,
    neutral: 0,
    avgScore: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sentiment/logs?limit=10');
      if (!response.ok) throw new Error('Failed to fetch sentiment logs');
      
      const data = await response.json();
      const fetchedLogs: SentimentLogEntry[] = data.logs || [];
      setLogs(fetchedLogs);

      // Calculate stats
      const total = fetchedLogs.length;
      const positive = fetchedLogs.filter(l => l.label === 'positive').length;
      const negative = fetchedLogs.filter(l => l.label === 'negative').length;
      const neutral = fetchedLogs.filter(l => l.label === 'neutral').length;
      const avgScore = total > 0
        ? fetchedLogs.reduce((sum, l) => sum + l.score, 0) / total
        : 0;

      setStats({ total, positive, negative, neutral, avgScore });
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching sentiment logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const getLabelColor = (label: string) => {
    switch (label) {
      case 'positive':
        return 'bg-[#00b686]/20 text-[#00b686] border-[#00b686]/30';
      case 'negative':
        return 'bg-[#ff4d4d]/20 text-[#ff4d4d] border-[#ff4d4d]/30';
      default:
        return 'bg-[#8A8A8A]/20 text-[#8A8A8A] border-[#8A8A8A]/30';
    }
  };

  const getLabelIcon = (label: string) => {
    switch (label) {
      case 'positive':
        return <TrendingUp size={14} className="text-[#00b686]" />;
      case 'negative':
        return <TrendingDown size={14} className="text-[#ff4d4d]" />;
      default:
        return <Minus size={14} className="text-[#8A8A8A]" />;
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const chartData = [
    { name: 'Positive', value: stats.positive, color: '#00b686' },
    { name: 'Negative', value: stats.negative, color: '#ff4d4d' },
    { name: 'Neutral', value: stats.neutral, color: '#8A8A8A' },
  ].filter(item => item.value > 0);

  return (
    <div className="bg-[#181818] border border-[#222] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-[#f5f5e8] mb-1">Sentiment Monitor</h2>
          <p className="text-xs text-[#a9a9a9]">CryptoBERT sentiment analysis</p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="p-2 hover:bg-[#141414] rounded transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={cn(loading && 'animate-spin', 'text-[#a9a9a9]')} />
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[#141414] border border-[#222] p-3 rounded">
          <div className="text-xs text-[#a9a9a9] mb-1">Total</div>
          <div className="text-lg font-bold text-[#f5f5e8]">{stats.total}</div>
        </div>
        <div className="bg-[#141414] border border-[#222] p-3 rounded">
          <div className="text-xs text-[#a9a9a9] mb-1">Positive</div>
          <div className="text-lg font-bold text-[#00b686]">{stats.positive}</div>
        </div>
        <div className="bg-[#141414] border border-[#222] p-3 rounded">
          <div className="text-xs text-[#a9a9a9] mb-1">Negative</div>
          <div className="text-lg font-bold text-[#ff4d4d]">{stats.negative}</div>
        </div>
        <div className="bg-[#141414] border border-[#222] p-3 rounded">
          <div className="text-xs text-[#a9a9a9] mb-1">Avg Confidence</div>
          <div className="text-lg font-bold text-[#f5f5e8]">{(stats.avgScore * 100).toFixed(1)}%</div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="mb-6 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#181818', 
                  border: '1px solid #222',
                  borderRadius: '4px',
                  color: '#f5f5e8'
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Latest Analyses */}
      <div>
        <h3 className="text-sm font-semibold text-[#f5f5e8] mb-3">Latest Analyses</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
          {loading && logs.length === 0 ? (
            <div className="text-center py-8 text-[#a9a9a9]">
              <RefreshCw className="animate-spin mx-auto mb-2" size={20} />
              Loading sentiment logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-[#a9a9a9]">
              No sentiment analyses yet. Start analyzing text to see results here.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="bg-[#141414] border border-[#222] p-3 rounded text-sm"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1">
                    {getLabelIcon(log.label)}
                    <span className={cn(
                      "px-2 py-1 rounded text-xs font-medium border",
                      getLabelColor(log.label)
                    )}>
                      {log.label.toUpperCase()}
                    </span>
                    <span className="text-xs text-[#a9a9a9]">
                      {(log.score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <span className="text-xs text-[#a9a9a9] flex-shrink-0 ml-2">
                    {formatTime(log.timestamp)}
                  </span>
                </div>
                <p className="text-[#f5f5e8] line-clamp-2 text-xs">
                  {log.text}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 text-xs text-[#a9a9a9] text-center">
        Last updated: {lastUpdate.toLocaleTimeString()}
      </div>
    </div>
  );
}


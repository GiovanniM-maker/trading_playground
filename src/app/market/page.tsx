'use client';

import { useEffect, useState, useMemo } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';

interface MarketData {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change_24h: number;
  high_24h: number;
  low_24h: number;
  volume: number;
  market_cap: number;
  updated_at: string;
  mock?: boolean;
}

interface HistoryPoint {
  time: string;
  value: number;
}

interface HistoryData {
  id: string;
  data: HistoryPoint[];
  mock?: boolean;
}

export default function MarketPage() {
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<string>('bitcoin');
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const fetchMarketData = async () => {
    try {
      setError(null);
      const response = await fetch('/api/market');
      if (!response.ok) throw new Error('Failed to fetch market data');
      
      const data = await response.json();
      setMarketData(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching market data:', err);
      setError('Failed to load market data. Using fallback.');
      setLoading(false);
    }
  };

  const fetchHistoryData = async (coinId: string) => {
    try {
      setHistoryError(null);
      setHistoryLoading(true);
      const response = await fetch(`/api/market/history?id=${coinId}`);
      if (!response.ok) throw new Error('Failed to fetch history data');
      
      const data = await response.json();
      setHistoryData(data);
      setHistoryLoading(false);
    } catch (err) {
      console.error('Error fetching history data:', err);
      setHistoryError('Failed to load history. Using fallback.');
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 60000); // Update every 60 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedCoin) {
      fetchHistoryData(selectedCoin);
      const interval = setInterval(() => fetchHistoryData(selectedCoin), 60000); // Update every 60 seconds
      return () => clearInterval(interval);
    }
  }, [selectedCoin]);

  const selectedCoinData = marketData.find(c => c.id === selectedCoin);
  const coinOptions = marketData.map(c => ({
    id: c.id,
    symbol: c.symbol.toUpperCase(),
    name: c.name,
  }));

  // Format chart data
  const chartData = useMemo(() => {
    if (!historyData || !historyData.data) return [];
    
    return historyData.data.map(point => ({
      time: new Date(point.time).toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit' 
      }),
      price: point.value,
      timestamp: point.time,
    }));
  }, [historyData]);

  // Determine line color based on price trend
  const lineColor = useMemo(() => {
    if (!chartData || chartData.length < 2) return '#00b686';
    const firstPrice = chartData[0].price;
    const lastPrice = chartData[chartData.length - 1].price;
    return lastPrice >= firstPrice ? '#00b686' : '#ff4d4d';
  }, [chartData]);

  return (
    <div className="flex flex-col w-full h-screen bg-[#0c0c0d] text-[#f5f5e8] overflow-hidden">
      <HeaderBar />
      <main className="flex-grow h-[calc(100vh-90px)] flex flex-col p-6 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#f5f5e8] uppercase tracking-wide mb-2">
            💹 Market Monitor
          </h1>
          {(error || historyError) && (
            <div className="text-xs text-yellow-500 mb-2">
              ⚠️ {(error || historyError) && 'Using fallback data'}
            </div>
          )}
          <div className="flex items-center gap-4">
            <select
              value={selectedCoin}
              onChange={(e) => {
                setSelectedCoin(e.target.value);
                setHistoryData(null);
              }}
              className="bg-[#181818] border border-[#222] px-4 py-2 text-sm text-[#f5f5e8] focus:outline-none focus:border-[#3a3a3a]"
            >
              {coinOptions.map(coin => (
                <option key={coin.id} value={coin.id}>
                  {coin.symbol} - {coin.name}
                </option>
              ))}
            </select>
            {selectedCoinData && (
              <span className="text-xs text-[#a9a9a9]">
                Last updated: {new Date(selectedCoinData.updated_at).toLocaleTimeString()}
                {selectedCoinData.mock && ' (Mock Data)'}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-full text-[#a9a9a9]">
            <div className="text-center">
              <div className="animate-pulse mb-2">Loading market data...</div>
              <div className="w-64 h-4 bg-[#181818] rounded animate-pulse"></div>
            </div>
          </div>
        ) : selectedCoinData ? (
          <>
            {/* Metrics */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-[#181818] border border-[#222] p-4">
                <div className="text-xs text-[#a9a9a9] mb-1">Current Price</div>
                {loading ? (
                  <div className="w-24 h-6 bg-[#141414] rounded animate-pulse"></div>
                ) : (
                  <div className="text-xl font-semibold text-[#f5f5e8]">
                    ${selectedCoinData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                )}
              </div>
              <div className="bg-[#181818] border border-[#222] p-4">
                <div className="text-xs text-[#a9a9a9] mb-1">24h Change</div>
                {loading ? (
                  <div className="w-20 h-6 bg-[#141414] rounded animate-pulse"></div>
                ) : (
                  <div className={cn(
                    "text-xl font-semibold",
                    selectedCoinData.change_24h >= 0 ? 'text-[#00b686]' : 'text-[#ff4d4d]'
                  )}>
                    {selectedCoinData.change_24h >= 0 ? '+' : ''}{selectedCoinData.change_24h.toFixed(2)}%
                  </div>
                )}
              </div>
              <div className="bg-[#181818] border border-[#222] p-4">
                <div className="text-xs text-[#a9a9a9] mb-1">24h High</div>
                {loading ? (
                  <div className="w-24 h-6 bg-[#141414] rounded animate-pulse"></div>
                ) : (
                  <div className="text-xl font-semibold text-[#f5f5e8]">
                    ${selectedCoinData.high_24h.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                )}
              </div>
              <div className="bg-[#181818] border border-[#222] p-4">
                <div className="text-xs text-[#a9a9a9] mb-1">24h Low</div>
                {loading ? (
                  <div className="w-24 h-6 bg-[#141414] rounded animate-pulse"></div>
                ) : (
                  <div className="text-xl font-semibold text-[#f5f5e8]">
                    ${selectedCoinData.low_24h.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-[#181818] border border-[#222] p-4">
                <div className="text-xs text-[#a9a9a9] mb-1">24h Volume</div>
                {loading ? (
                  <div className="w-32 h-5 bg-[#141414] rounded animate-pulse"></div>
                ) : (
                  <div className="text-lg font-semibold text-[#f5f5e8]">
                    ${(selectedCoinData.volume / 1e9).toFixed(2)}B
                  </div>
                )}
              </div>
              <div className="bg-[#181818] border border-[#222] p-4">
                <div className="text-xs text-[#a9a9a9] mb-1">Market Cap</div>
                {loading ? (
                  <div className="w-32 h-5 bg-[#141414] rounded animate-pulse"></div>
                ) : (
                  <div className="text-lg font-semibold text-[#f5f5e8]">
                    ${(selectedCoinData.market_cap / 1e9).toFixed(2)}B
                  </div>
                )}
              </div>
            </div>

            {/* 7-Day Chart */}
            <div className="flex-grow h-full min-h-[500px] bg-[#181818] border border-[#222] p-4">
              <div className="mb-2 text-xs text-[#a9a9a9] uppercase tracking-wide">
                7-Day Price History {historyData?.mock && '(Mock Data)'}
              </div>
              {historyLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-pulse mb-2 text-[#a9a9a9]">Loading chart data...</div>
                    <div className="w-96 h-64 bg-[#141414] rounded animate-pulse"></div>
                  </div>
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-[#a9a9a9]">
                  No chart data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis 
                      dataKey="time" 
                      stroke="#a9a9a9"
                      tick={{ fill: '#a9a9a9', fontSize: 10 }}
                      interval="preserveStartEnd"
                      axisLine={{ stroke: '#222' }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      stroke="#a9a9a9"
                      tick={{ fill: '#a9a9a9', fontSize: 11 }}
                      domain={['auto', 'auto']}
                      tickFormatter={(value) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                      axisLine={{ stroke: '#222' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#181818', 
                        border: '1px solid #222',
                        color: '#f5f5e8'
                      }}
                      labelStyle={{ color: '#a9a9a9' }}
                      formatter={(value: number) => [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Price']}
                      labelFormatter={(label) => `Time: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke={lineColor}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: lineColor }}
                      isAnimationActive={true}
                      animationDuration={500}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-[#a9a9a9]">
            No market data available
          </div>
        )}
      </main>
    </div>
  );
}

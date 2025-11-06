'use client';

import { useEffect, useState } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { COINS, CoinConfig } from '@/lib/market/config';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface LivePrice {
  symbol: string;
  name: string;
  price_usd: number;
  change_24h: number;
}

interface HistoricalPoint {
  date: string;
  price: number;
  market_cap: number;
  volume: number;
}

interface NewsItem {
  title: string;
  url: string;
  source: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  published_at: string;
}

export default function MonitorPage() {
  const [selectedCoin, setSelectedCoin] = useState<CoinConfig>(COINS[0]);
  const [livePrices, setLivePrices] = useState<LivePrice[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalPoint[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '1m' | '1y' | 'all'>('1m');

  const fetchMarketData = async () => {
    try {
      const response = await fetch('/api/markets');
      if (!response.ok) throw new Error('Failed to fetch market data');
      
      const data = await response.json();
      setLivePrices(data.live || []);
      
      // Format historical data for selected coin
      const coinHistory = data.history?.[selectedCoin.symbol];
      if (coinHistory && coinHistory.prices) {
        const formatted = coinHistory.prices.map(([date, price]: [string, number]) => ({
          date: new Date(date).toISOString(),
          price: price,
        }));
        setHistoricalData(formatted);
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
    }
  };

  const fetchNews = async () => {
    try {
      const response = await fetch('/api/news');
      if (!response.ok) throw new Error('Failed to fetch news');
      
      const data = await response.json();
      const newsItems: NewsItem[] = (data.results || []).map((item: any) => ({
        title: item.title,
        url: item.url,
        source: item.source,
        sentiment: item.sentiment || item.sentiment_label || 'Neutral',
        published_at: item.published_at,
      }));
      setNews(newsItems.slice(0, 10));
    } catch (error) {
      console.error('Error fetching news:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchMarketData();
      await fetchNews();
      setLoading(false);
    };

    loadData();

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchMarketData();
      fetchNews();
    }, 60000);

    return () => clearInterval(interval);
  }, [selectedCoin]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'Bullish': return 'bg-[#00b686]/20 text-[#00b686] border-[#00b686]/30';
      case 'Bearish': return 'bg-[#ff4d4d]/20 text-[#ff4d4d] border-[#ff4d4d]/30';
      default: return 'bg-[#8A8A8A]/20 text-[#8A8A8A] border-[#8A8A8A]/30';
    }
  };

  // Filter historical data based on time range
  const filteredData = historicalData.filter((point) => {
    if (timeRange === 'all') return true;
    
    const pointDate = new Date(point.date);
    const now = new Date();
    const days = {
      '7d': 7,
      '1m': 30,
      '1y': 365,
    }[timeRange] || 30;
    
    return (now.getTime() - pointDate.getTime()) <= days * 24 * 60 * 60 * 1000;
  });

  const currentPrice = livePrices.find(p => p.symbol === selectedCoin.symbol);

  return (
    <div className="flex flex-col w-full h-screen bg-[#0c0c0d] text-[#f5f5e8] overflow-hidden">
      <HeaderBar />
      <main className="flex-grow h-[calc(100vh-90px)] flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center gap-2 p-4 border-b border-[#222] bg-[#141414]">
          {COINS.map((coin) => (
            <button
              key={coin.id}
              onClick={() => setSelectedCoin(coin)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors border border-[#222]",
                selectedCoin.id === coin.id
                  ? "bg-[#181818] text-[#f5f5e8] border-[#3a3a3a]"
                  : "bg-[#141414] text-[#a9a9a9] hover:text-[#f5f5e8] hover:border-[#3a3a3a]"
              )}
              style={selectedCoin.id === coin.id ? { borderColor: coin.color } : {}}
            >
              {coin.symbol}
            </button>
          ))}
        </div>

        <div className="flex-grow flex flex-col min-h-0">
          {/* Chart Section */}
          <div className="flex-grow flex flex-col p-6 min-h-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-[#f5f5e8]">
                  {selectedCoin.name} ({selectedCoin.symbol})
                </h2>
                {currentPrice && (
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-2xl font-bold text-[#f5f5e8]">
                      ${currentPrice.price_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={cn(
                      "text-lg font-semibold",
                      currentPrice.change_24h >= 0 ? "text-[#00b686]" : "text-[#ff4d4d]"
                    )}>
                      {currentPrice.change_24h >= 0 ? '+' : ''}{currentPrice.change_24h.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {(['7d', '1m', '1y', 'all'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={cn(
                      "px-3 py-1 text-xs font-medium transition-colors border border-[#222]",
                      timeRange === range
                        ? "bg-[#181818] text-[#f5f5e8] border-[#3a3a3a]"
                        : "bg-[#141414] text-[#a9a9a9] hover:text-[#f5f5e8] hover:border-[#3a3a3a]"
                    )}
                  >
                    {range === 'all' ? 'All' : range.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-full text-[#a9a9a9]">
                Loading chart data...
              </div>
            ) : (
              <div className="flex-grow min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#a9a9a9"
                      tick={{ fill: '#a9a9a9', fontSize: 10 }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis 
                      stroke="#a9a9a9"
                      tick={{ fill: '#a9a9a9', fontSize: 12 }}
                      domain={['auto', 'auto']}
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#181818', 
                        border: '1px solid #222',
                        borderRadius: '4px',
                        color: '#f5f5e8'
                      }}
                      formatter={(value: number) => [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Price']}
                      labelFormatter={(label) => new Date(label).toLocaleString()}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke={selectedCoin.color}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* News Section */}
          <div className="h-64 border-t border-[#222] bg-[#141414] p-4 overflow-y-auto">
            <h3 className="text-sm font-semibold text-[#f5f5e8] mb-3 uppercase tracking-wide">Latest News</h3>
            <div className="space-y-2">
              {news.length === 0 ? (
                <div className="text-xs text-[#a9a9a9]">No news available</div>
              ) : (
                news.map((item, index) => (
                  <a
                    key={index}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-[#181818] border border-[#222] p-3 hover:border-[#3a3a3a] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-[#f5f5e8] mb-1 line-clamp-2">
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-[#a9a9a9]">
                          <span>{item.source}</span>
                          <span>•</span>
                          <span>{formatTime(item.published_at)}</span>
                        </div>
                      </div>
                      <span className={cn(
                        "text-xs font-medium px-2 py-1 border flex-shrink-0",
                        getSentimentColor(item.sentiment)
                      )}>
                        {item.sentiment}
                      </span>
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


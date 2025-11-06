'use client';

import { useEffect, useState } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { COINS, CoinConfig } from '@/lib/market/config';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MarketData {
  symbol: string;
  price: number;
  change_24h: number;
  volume_24h: number;
  market_cap: number;
  history: Array<{ time: string; price: number }>;
  coin: {
    id: string;
    name: string;
    color: string;
  };
}

interface NewsItem {
  title: string;
  url: string;
  source: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  published_at: string;
}

export default function MarketPage() {
  const [selectedCoin, setSelectedCoin] = useState<CoinConfig>(COINS[0]);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d' | '1y' | 'all'>('7d');
  const [newsSidebarOpen, setNewsSidebarOpen] = useState(true);

  const fetchMarketData = async () => {
    try {
      const response = await fetch(`/api/market?symbol=${selectedCoin.symbol}`);
      if (!response.ok) throw new Error('Failed to fetch market data');
      
      const data = await response.json();
      setMarketData(data);
    } catch (error) {
      console.error('Error fetching market data:', error);
    }
  };

  const fetchNews = async () => {
    try {
      const response = await fetch(`/api/news?symbol=${selectedCoin.symbol}`);
      if (!response.ok) throw new Error('Failed to fetch news');
      
      const data = await response.json();
      const newsItems: NewsItem[] = (data.results || [])
        .slice(0, 10)
        .map((item: any) => ({
          title: item.title,
          url: item.url,
          source: item.source || 'Unknown',
          sentiment: item.sentiment || item.sentiment_label || 'Neutral',
          published_at: item.published_at || new Date().toISOString(),
        }));
      setNews(newsItems);
    } catch (error) {
      console.error('Error fetching news:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchMarketData();
      await fetchNews();
      setLoading(false);
    };

    loadData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchMarketData();
      fetchNews();
    }, 30000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const filteredHistory = marketData?.history.filter((point) => {
    if (timeRange === 'all') return true;
    
    const pointDate = new Date(point.time);
    const now = new Date();
    const days = {
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
    }[timeRange] || 7;
    
    return (now.getTime() - pointDate.getTime()) <= days * 24 * 60 * 60 * 1000;
  }) || [];

  const formatNumber = (num: number) => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  return (
    <div className="flex flex-col w-full h-screen bg-[#0c0c0d] text-[#f5f5e8] overflow-hidden">
      <HeaderBar />
      <main className="flex-grow h-[calc(100vh-90px)] flex overflow-hidden">
        {/* Main Content */}
        <div className={cn(
          "flex-grow flex flex-col transition-all duration-300",
          newsSidebarOpen ? "mr-80" : "mr-0"
        )}>
          {/* Coin Tabs */}
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

          {/* Market Data */}
          <div className="flex-grow flex flex-col p-6 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-full text-[#a9a9a9]">
                Loading market data...
              </div>
            ) : marketData ? (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-[#181818] border border-[#222] p-4">
                    <div className="text-xs text-[#a9a9a9] mb-1">Current Price</div>
                    <div className="text-xl font-bold text-[#f5f5e8]">
                      ${marketData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-[#181818] border border-[#222] p-4">
                    <div className="text-xs text-[#a9a9a9] mb-1">24h Change</div>
                    <div className={cn(
                      "text-xl font-bold",
                      marketData.change_24h >= 0 ? "text-[#00b686]" : "text-[#ff4d4d]"
                    )}>
                      {marketData.change_24h >= 0 ? '+' : ''}{marketData.change_24h.toFixed(2)}%
                    </div>
                  </div>
                  <div className="bg-[#181818] border border-[#222] p-4">
                    <div className="text-xs text-[#a9a9a9] mb-1">24h Volume</div>
                    <div className="text-xl font-bold text-[#f5f5e8]">
                      {formatNumber(marketData.volume_24h)}
                    </div>
                  </div>
                  <div className="bg-[#181818] border border-[#222] p-4">
                    <div className="text-xs text-[#a9a9a9] mb-1">Market Cap</div>
                    <div className="text-xl font-bold text-[#f5f5e8]">
                      {formatNumber(marketData.market_cap)}
                    </div>
                  </div>
                </div>

                {/* Time Range Selector */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-[#f5f5e8]">
                    {selectedCoin.name} ({selectedCoin.symbol})
                  </h2>
                  <div className="flex gap-2">
                    {(['24h', '7d', '30d', '90d', '1y', 'all'] as const).map((range) => (
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
                        {range.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chart */}
                <div className="flex-grow min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis 
                        dataKey="time" 
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
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-[#a9a9a9]">
                No market data available
              </div>
            )}
          </div>
        </div>

        {/* News Sidebar */}
        <div className={cn(
          "w-80 bg-[#181818] border-l border-[#222] flex flex-col transition-all duration-300",
          newsSidebarOpen ? "translate-x-0" : "translate-x-full"
        )}>
          <div className="flex items-center justify-between p-4 border-b border-[#222]">
            <h3 className="text-sm font-semibold text-[#f5f5e8] uppercase tracking-wide">
              Latest News
            </h3>
            <button
              onClick={() => setNewsSidebarOpen(false)}
              className="p-1 hover:bg-[#141414] transition-colors"
            >
              <ChevronRight size={18} className="text-[#a9a9a9]" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {news.length === 0 ? (
              <div className="text-xs text-[#a9a9a9]">No news available</div>
            ) : (
              news.map((item, index) => (
                <a
                  key={index}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-[#141414] border border-[#222] p-3 hover:border-[#3a3a3a] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={cn(
                      "text-xs font-medium px-2 py-1 border flex-shrink-0",
                      getSentimentColor(item.sentiment)
                    )}>
                      {item.sentiment}
                    </span>
                    <span className="text-xs text-[#a9a9a9]">{formatTime(item.published_at)}</span>
                  </div>
                  <h4 className="text-xs font-semibold text-[#f5f5e8] mb-1 line-clamp-2">
                    {item.title}
                  </h4>
                  <div className="text-xs text-[#a9a9a9]">{item.source}</div>
                </a>
              ))
            )}
          </div>
        </div>

        {/* Sidebar Toggle Button (when closed) */}
        {!newsSidebarOpen && (
          <button
            onClick={() => setNewsSidebarOpen(true)}
            className="fixed top-[70px] right-2 p-2 bg-[#181818] border border-[#222] hover:border-[#3a3a3a] transition-colors z-[60]"
          >
            <ChevronLeft size={18} className="text-[#f5f5e8]" />
          </button>
        )}
      </main>
    </div>
  );
}

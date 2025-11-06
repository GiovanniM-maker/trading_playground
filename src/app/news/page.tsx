'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { HeaderBar } from '@/components/HeaderBar';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

interface NewsItem {
  id: string;
  title: string;
  description?: string;
  url: string;
  published_at: string;
  image?: string;
  source: string;
  instruments?: string[];
  sentiment_score: number;
  sentiment_label: 'Bullish' | 'Neutral' | 'Bearish';
}

interface NewsResponse {
  results: NewsItem[];
  source_status: {
    CoinDesk: 'ok' | 'error';
    CoinTelegraph: 'ok' | 'error';
    CoinGecko: 'ok' | 'error';
  };
}

type SortOption = 'latest' | 'highest_sentiment' | 'most_bearish';

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [assetFilter, setAssetFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('latest');
  const [loading, setLoading] = useState(true);
  const [newsStats, setNewsStats] = useState<{ count: number; last_updated: string; cached: boolean } | null>(null);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/news');
      if (!response.ok) throw new Error('Failed to fetch news');
      
      const data: NewsResponse = await response.json();
      setNews(data.results || []);
      setNewsStats({
        count: data.count || data.results.length,
        last_updated: data.last_updated || new Date().toISOString(),
        cached: data.cached || false,
      });
      setLoading(false);
    } catch (err) {
      console.error('Error fetching news:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 120000); // Refresh every 2 minutes
    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'CoinDesk': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'CoinTelegraph': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'CoinGecko': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-[#141414] text-[#a9a9a9] border-[#222]';
    }
  };

  const getSentimentColor = (label: string) => {
    switch (label) {
      case 'Bullish': return 'bg-[#00b686]/20 text-[#00b686] border-[#00b686]/30';
      case 'Bearish': return 'bg-[#ff4d4d]/20 text-[#ff4d4d] border-[#ff4d4d]/30';
      default: return 'bg-[#8A8A8A]/20 text-[#8A8A8A] border-[#8A8A8A]/30';
    }
  };

  // Apply filters and sorting
  const filteredAndSorted = news
    .filter(item => {
      if (sourceFilter !== 'all' && item.source.toLowerCase() !== sourceFilter.toLowerCase()) {
        return false;
      }
      if (assetFilter !== 'all' && !item.instruments?.some(inst => inst.toLowerCase() === assetFilter.toLowerCase())) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'latest':
          return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
        case 'highest_sentiment':
          return b.sentiment_score - a.sentiment_score;
        case 'most_bearish':
          return a.sentiment_score - b.sentiment_score;
        default:
          return 0;
      }
    });

  return (
    <div className="flex flex-col w-full h-screen bg-[#0c0c0d] text-[#f5f5e8] overflow-hidden">
      <HeaderBar />
      <main className="flex-grow h-[calc(100vh-90px)] flex flex-col p-6 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#f5f5e8] uppercase tracking-wide mb-4">
            Crypto News Feed
          </h1>
          
          {/* News Stats */}
          {newsStats && (
            <div className="flex gap-4 mb-4 text-xs text-[#a9a9a9]">
              <span>Articles: <span className="text-[#f5f5e8]">{newsStats.count}</span></span>
              <span>Last updated: <span className="text-[#f5f5e8]">{new Date(newsStats.last_updated).toLocaleString()}</span></span>
              {newsStats.cached && <span className="text-[#00b686]">(Cached)</span>}
            </div>
          )}
          
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex gap-2">
              <span className="text-xs text-[#a9a9a9] self-center">Source:</span>
              {['all'].map((option) => (
                <button
                  key={option}
                  onClick={() => setSourceFilter(option)}
                  className={cn(
                    "px-3 py-1 text-xs font-medium transition-colors border border-[#222]",
                    sourceFilter === option
                      ? "bg-[#181818] text-[#f5f5e8] border-[#3a3a3a]"
                      : "bg-[#141414] text-[#a9a9a9] hover:text-[#f5f5e8] hover:border-[#3a3a3a]"
                  )}
                >
                  {option === 'all' ? 'All' : option}
                </button>
              ))}
            </div>
            
            <div className="flex gap-2">
              <span className="text-xs text-[#a9a9a9] self-center">Asset:</span>
              {['all', 'BTC', 'ETH', 'SOL'].map((option) => (
                <button
                  key={option}
                  onClick={() => setAssetFilter(option)}
                  className={cn(
                    "px-3 py-1 text-xs font-medium transition-colors border border-[#222]",
                    assetFilter === option
                      ? "bg-[#181818] text-[#f5f5e8] border-[#3a3a3a]"
                      : "bg-[#141414] text-[#a9a9a9] hover:text-[#f5f5e8] hover:border-[#3a3a3a]"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
            
            <div className="flex gap-2">
              <span className="text-xs text-[#a9a9a9] self-center">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-[#181818] border border-[#222] px-3 py-1 text-xs text-[#f5f5e8] focus:outline-none focus:border-[#3a3a3a]"
              >
                <option value="latest">Latest</option>
                <option value="highest_sentiment">Highest Sentiment</option>
                <option value="most_bearish">Most Bearish</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-full text-[#a9a9a9]">
            <div className="text-center">
              <div className="animate-pulse mb-2">Loading news from multiple sources...</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-[#181818] border border-[#222] p-4 animate-pulse">
                    <div className="w-3/4 h-4 bg-[#141414] rounded mb-2"></div>
                    <div className="w-full h-3 bg-[#141414] rounded mb-2"></div>
                    <div className="w-1/2 h-3 bg-[#141414] rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAndSorted.length === 0 ? (
              <div className="col-span-2 text-center text-[#a9a9a9] py-12">
                No news available
              </div>
            ) : (
              filteredAndSorted.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#181818] border border-[#222] p-5 hover:border-[#3a3a3a] hover:shadow-lg transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-4">
                    {item.image && (
                      <div className="w-20 h-20 flex-shrink-0 relative">
                        <Image
                          src={item.image.replace(/&amp;/g, '&')}
                          alt={item.title}
                          fill
                          className="object-cover rounded border border-[#222]"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                          unoptimized
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={cn(
                          "text-xs font-medium px-2 py-1 border",
                          getSourceColor(item.source)
                        )}>
                          {item.source}
                        </span>
                        <span className={cn(
                          "text-xs font-medium px-2 py-1 border",
                          getSentimentColor(item.sentiment_label)
                        )}>
                          {item.sentiment_label} {item.sentiment_score > 0 ? '+' : ''}{item.sentiment_score}
                        </span>
                        {item.instruments && item.instruments.length > 0 && (
                          <>
                            {item.instruments.slice(0, 3).map((inst) => (
                              <span
                                key={inst}
                                className="text-xs font-medium px-2 py-1 bg-[#141414] text-[#f5f5e8] border border-[#222]"
                              >
                                {inst}
                              </span>
                            ))}
                          </>
                        )}
                        <span className="text-xs text-[#a9a9a9] ml-auto">{formatTime(item.published_at)}</span>
                        <ExternalLink className="h-3 w-3 text-[#a9a9a9] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <h3 className="text-sm font-semibold text-[#f5f5e8] group-hover:text-[#00b686] transition-colors mb-2 line-clamp-2">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="text-xs text-[#a9a9a9] opacity-80 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                </a>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

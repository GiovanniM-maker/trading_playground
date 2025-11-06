'use client';

import { useState, useEffect } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';

interface NewsArticle {
  source: string;
  title: string;
  link: string;
  published: string;
  description: string;
}

interface NewsResponse {
  count: number;
  articles: NewsArticle[];
  cached: boolean;
  timestamp: string;
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cached, setCached] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchNews = async (force = false) => {
    try {
      if (force) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await fetch(`/api/news${force ? '?refresh=true' : ''}`);
      if (!response.ok) throw new Error('Failed to fetch news');
      
      const data: NewsResponse = await response.json();
      setNews(data.articles || []);
      setCached(data.cached);
      setLastUpdate(data.timestamp ? new Date(data.timestamp) : new Date());
    } catch (error) {
      console.error('Error fetching news:', error);
      setNews([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const formatSource = (source: string) => {
    return source
      .split('')
      .map((char, i) => (i === 0 ? char.toUpperCase() : char))
      .join('')
      .replace(/([A-Z])/g, ' $1')
      .trim();
  };

  return (
    <div className="flex flex-col w-full h-screen bg-[#0c0c0d] text-[#f5f5e8] overflow-hidden">
      <HeaderBar />
      <main className="flex-grow h-[calc(100vh-90px)] flex flex-col p-6 overflow-y-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#f5f5e8] uppercase tracking-wide">
            Crypto News Feed
          </h1>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-sm text-[#a9a9a9]">
                Updated {formatRelativeTime(lastUpdate)}
              </span>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#181818] border border-[#222] rounded">
              <span className={`w-2 h-2 rounded-full ${cached ? 'bg-yellow-500' : 'bg-[#00b686]'}`} />
              <span className="text-xs text-[#a9a9a9]">
                {cached ? 'Cached' : 'Live'}
              </span>
            </div>
            <button
              onClick={() => fetchNews(true)}
              disabled={refreshing || loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#181818] text-[#f5f5e8] border border-[#222] hover:border-[#3a3a3a] transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              Force Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="animate-spin text-[#a9a9a9]" size={32} />
          </div>
        ) : news.length === 0 ? (
          <Card className="bg-[#181818] border border-[#222]">
            <CardContent className="p-6">
              <p className="text-[#a9a9a9] text-center">
                No news articles available at the moment.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {news.map((article, index) => (
              <Card
                key={`${article.link}-${index}`}
                className="bg-[#181818] border border-[#222] hover:border-[#3a3a3a] transition-colors"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-medium text-[#00b686] uppercase">
                      {formatSource(article.source)}
                    </span>
                    <span className="text-xs text-[#a9a9a9]">
                      {formatRelativeTime(new Date(article.published))}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-[#f5f5e8] line-clamp-2">
                    {article.title}
                  </h3>
                </CardHeader>
                <CardContent>
                  {article.description && (
                    <p className="text-sm text-[#a9a9a9] line-clamp-3 mb-3">
                      {article.description}
                    </p>
                  )}
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#00b686] hover:text-[#00d4a3] transition-colors inline-flex items-center gap-1"
                  >
                    Read more →
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

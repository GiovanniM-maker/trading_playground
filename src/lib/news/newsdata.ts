import { getCache, setCache } from '../redis';
import { logError } from '../errors/logs';

export interface NewsDataArticle {
  title: string;
  source: string;
  date: string;
  url: string;
  description: string;
  image?: string;
  published_at: string;
}

const CACHE_KEY = 'news:latest';
const CACHE_TTL = 12 * 60 * 60; // 12 hours

export async function fetchNewsData(): Promise<NewsDataArticle[]> {
  const apiKey = process.env.NEWSDATA_API_KEY;
  
  if (!apiKey) {
    throw new Error('Missing NEWSDATA_API_KEY environment variable');
  }

  try {
    const url = `https://newsdata.io/api/1/news?apikey=${apiKey}&q=crypto&language=en&category=technology,business`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      const errorMsg = `HTTP ${response.status}: ${errorText}`;
      
      // Log error
      await logError('NewsData.io', errorMsg, response.status);
      
      throw new Error(errorMsg);
    }

    const data = await response.json();
    
    if (!data.results || !Array.isArray(data.results)) {
      throw new Error('Invalid response format from NewsData.io');
    }

    // Map NewsData.io format to our normalized format
    const articles: NewsDataArticle[] = data.results.map((item: any) => ({
      title: item.title || '',
      source: item.source_id || item.source || 'Unknown',
      date: item.pubDate || new Date().toISOString(),
      url: item.link || item.url || '',
      description: item.description || item.content || '',
      image: item.image_url || undefined,
      published_at: item.pubDate || new Date().toISOString(),
    })).filter((article: NewsDataArticle) => 
      article.title && article.url && article.url !== '#'
    );

    return articles;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching NewsData.io:', errorMsg);
    await logError('NewsData.io', errorMsg);
    throw error;
  }
}

export async function getCachedNewsData(): Promise<NewsDataArticle[] | null> {
  try {
    const cached = await getCache(CACHE_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached as NewsDataArticle[];
    }
    return null;
  } catch (error) {
    console.error('Error getting cached news:', error);
    return null;
  }
}

export async function cacheNewsData(articles: NewsDataArticle[]): Promise<void> {
  try {
    await setCache(CACHE_KEY, articles, CACHE_TTL);
  } catch (error) {
    console.error('Error caching news:', error);
  }
}


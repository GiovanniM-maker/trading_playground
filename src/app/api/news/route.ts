import { NextResponse } from 'next/server';
import { getLocalNews, refreshLocalNews, LocalNewsArticle } from '@/lib/news/local';
import { analyzeSentiment, sentimentToLabel } from '@/lib/sentiment';

interface NewsResult extends LocalNewsArticle {
  sentiment_score: number;
  sentiment_label: 'Bullish' | 'Neutral' | 'Bearish';
}

interface NewsResponse {
  results: NewsResult[];
  count: number;
  last_updated: string;
  cached: boolean;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const refresh = searchParams.get('refresh') === 'true';
    
    // Get local news (from cache or seed file)
    const { results: articles, cached } = refresh 
      ? await refreshLocalNews()
      : await getLocalNews();

    if (articles.length === 0) {
      return NextResponse.json({
        results: [],
        count: 0,
        last_updated: new Date().toISOString(),
        cached: false,
      });
    }

    // Filter by symbol if provided
    let filtered = articles;
    if (symbol) {
      filtered = articles.filter((item) => 
        item.title.toUpperCase().includes(symbol.toUpperCase()) ||
        item.description?.toUpperCase().includes(symbol.toUpperCase()) ||
        item.source.toUpperCase().includes(symbol.toUpperCase())
      );
    }

    // Compute sentiment for each item
    const withSentiment = await Promise.all(
      filtered.slice(0, 50).map(async (item) => {
        const text = `${item.title}. ${item.description || ''}`;
        const sentiment = await analyzeSentiment(text);
        const label = sentimentToLabel(sentiment);
        
        return {
          ...item,
          sentiment_score: sentiment.score,
          sentiment_label: label,
        };
      })
    );

    // Sort by published_at desc
    withSentiment.sort((a, b) => 
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );

    const latency = Date.now() - startTime;
    const lastUpdated = articles.length > 0 
      ? articles[0]?.published_at || new Date().toISOString()
      : new Date().toISOString();

    const response = NextResponse.json({
      results: withSentiment,
      count: withSentiment.length,
      last_updated: lastUpdated,
      cached,
    });
    
    response.headers.set('X-Latency', latency.toString());
    response.headers.set('Cache-Control', 'public, s-maxage=43200, stale-while-revalidate=3600');
    
    return response;
  } catch (error) {
    console.error('Error in news API:', error);
    
    return NextResponse.json({
      results: [],
      count: 0,
      last_updated: new Date().toISOString(),
      cached: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

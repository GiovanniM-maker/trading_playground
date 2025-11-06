import { fetchCryptoNewsWithSentiment } from '@/lib/news/aggregator';
import { getCache } from '@/lib/redis';
import { logger } from '@/lib/logger';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const force = searchParams.get('refresh') === 'true';
  
  try {
    const { articles, sentimentPerCoin } = await fetchCryptoNewsWithSentiment(force);
    
    // Get cached sentiment if not forcing refresh
    const cachedSentiment = force ? null : await getCache('sentiment:perCoin');
    const finalSentimentPerCoin = sentimentPerCoin || cachedSentiment || {};
    
    return Response.json({ 
      count: articles.length, 
      articles, 
      sentimentPerCoin: finalSentimentPerCoin,
      cached: !force,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ service: 'api', route: 'news', error: error instanceof Error ? error.message : 'Unknown error' }, 'Error fetching news');
    
    // Try to return cached data as fallback
    try {
      const cachedSentiment = await getCache('sentiment:perCoin');
      return Response.json(
        { 
          error: 'Failed to fetch news',
          message: error instanceof Error ? error.message : 'Unknown error',
          count: 0,
          articles: [],
          sentimentPerCoin: cachedSentiment || {},
        },
        { status: 500 }
      );
    } catch {
      return Response.json(
        { 
          error: 'Failed to fetch news',
          message: error instanceof Error ? error.message : 'Unknown error',
          count: 0,
          articles: [],
          sentimentPerCoin: {},
        },
        { status: 500 }
      );
    }
  }
}


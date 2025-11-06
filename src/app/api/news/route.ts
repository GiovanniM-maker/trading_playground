import { NextResponse } from 'next/server';
import { fetchCryptoPanic, fetchCoinDesk, fetchCoinTelegraph, fetchCoinGecko } from '@/lib/news/sources';
import { deduplicateNews } from '@/lib/news/deduplicate';
import { computeSentiment } from '@/lib/sentiment';
import { NormalizedNews } from '@/lib/news/normalize';

interface NewsResult extends NormalizedNews {
  sentiment_score: number;
  sentiment_label: 'Bullish' | 'Neutral' | 'Bearish';
  sentiment_confidence: number;
}

interface NewsResponse {
  results: NewsResult[];
  source_status: {
    CryptoPanic: 'ok' | 'error';
    CoinDesk: 'ok' | 'error';
    CoinTelegraph: 'ok' | 'error';
    CoinGecko: 'ok' | 'error';
  };
}

export async function GET() {
  try {
    // Fetch all sources in parallel
    const results = await Promise.allSettled([
      fetchCryptoPanic(),
      fetchCoinDesk(),
      fetchCoinTelegraph(),
      fetchCoinGecko(),
    ]);

    const allNews: NormalizedNews[] = [];
    const sourceStatus: NewsResponse['source_status'] = {
      CryptoPanic: 'error',
      CoinDesk: 'error',
      CoinTelegraph: 'error',
      CoinGecko: 'error',
    };

    // Collect results and update status
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const { items, status } = result.value;
        allNews.push(...items);
        
        const sourceNames = ['CryptoPanic', 'CoinDesk', 'CoinTelegraph', 'CoinGecko'] as const;
        sourceStatus[sourceNames[index]] = status;
      } else {
        console.error(`Source ${index} failed:`, result.reason);
      }
    });

    // Filter out invalid items
    const validNews = allNews.filter(item => item.title && item.url && item.url !== '#');

    if (validNews.length === 0) {
      return NextResponse.json({
        results: [],
        source_status: sourceStatus,
      });
    }

    // Deduplicate using embeddings
    const deduplicated = await deduplicateNews(validNews);

    // Compute sentiment for each item
    const withSentiment = await Promise.all(
      deduplicated.map(async (item) => {
        const sentiment = await computeSentiment(item);
        return {
          ...item,
          sentiment_score: sentiment.score,
          sentiment_label: sentiment.label,
          sentiment_confidence: sentiment.confidence,
        };
      })
    );

    // Sort by published_at desc
    withSentiment.sort((a, b) => 
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );

    // Limit to 50 items
    const limited = withSentiment.slice(0, 50);

    const response = NextResponse.json({
      results: limited,
      source_status: sourceStatus,
    });
    
    response.headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=60');
    
    return response;
  } catch (error) {
    console.error('Error in news aggregation:', error);
    return NextResponse.json({
      results: [],
      source_status: {
        CryptoPanic: 'error',
        CoinDesk: 'error',
        CoinTelegraph: 'error',
        CoinGecko: 'error',
      },
    }, { status: 500 });
  }
}

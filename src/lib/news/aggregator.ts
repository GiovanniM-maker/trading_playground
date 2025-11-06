import { XMLParser } from 'fast-xml-parser';
import { getCache, setCache } from '@/lib/redis';
import { analyzeSentiment } from '@/lib/sentiment';
import { COINS } from '@/lib/market/config';
import { logger } from '@/lib/logger';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
});

const FETCH_OPTIONS = {
  headers: {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
  signal: AbortSignal.timeout(8000),
} as const;

export interface AggregatedNewsArticle {
  source: string;
  title: string;
  link: string;
  published: string;
  description: string;
  sentiment?: {
    label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'neutral' | 'positive' | 'negative';
    confidence: number;
  };
  coins?: string[];
}

export interface SentimentPerCoin {
  [coin: string]: {
    avg: number;
    count: number;
    updated: string;
  };
}

const SOURCES = [
  { id: 'coindesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { id: 'cointelegraph', url: 'https://cointelegraph.com/rss' },
  { id: 'decrypt', url: 'https://decrypt.co/feed' },
];

async function fetchWithRetry(url: string, maxRetries = 1): Promise<Response | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, FETCH_OPTIONS);
      
      if (response.status === 429 || response.status === 503) {
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          continue;
        }
      }
      
      return response;
    } catch (error) {
      if (attempt === maxRetries) {
        logger.warn({ service: 'news', url, error: error instanceof Error ? error.message : 'Unknown error' }, `Failed to fetch ${url}`);
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  return null;
}

export async function fetchCryptoNews(force = false): Promise<AggregatedNewsArticle[]> {
  const cacheKey = 'news:aggregated:latest';
  
  if (!force) {
    const cached = await getCache(cacheKey);
    if (cached && Array.isArray(cached)) {
      return cached as AggregatedNewsArticle[];
    }
  }

  const articles: AggregatedNewsArticle[] = [];

  for (const src of SOURCES) {
    try {
      const response = await fetchWithRetry(src.url);
      if (!response || !response.ok) {
        logger.warn({ service: 'news', source: src.id, status: response?.status || 'unknown' }, `Failed to fetch ${src.id}: HTTP ${response?.status || 'unknown'}`);
        continue;
      }

      const xmlText = await response.text();
      const parsed = parser.parse(xmlText);
      const items = parsed.rss?.channel?.item || [];
      
      // Handle both single item and array
      const itemsArray = Array.isArray(items) ? items : [items];
      
      for (const item of itemsArray.slice(0, 15)) {
        // Handle both direct values and #text nodes (XMLParser format)
        const title = (typeof item.title === 'string' ? item.title : item.title?.['#text']) || '';
        const link = (typeof item.link === 'string' ? item.link : item.link?.['#text']) || '';
        const description = (typeof item.description === 'string' ? item.description : item.description?.['#text']) || 
                           item.contentSnippet || 
                           item.content?.['#text'] || 
                           '';
        const pubDate = item.pubDate || item.isoDate || item['dc:date'] || item.published || '';
        
        if (title && link) {
          articles.push({
            source: src.id,
            title: title.trim(),
            link: link.trim(),
            published: pubDate || new Date().toISOString(),
            description: description.replace(/<[^>]*>/g, '').slice(0, 250).trim(),
          });
        }
      }
    } catch (err) {
      logger.warn({ service: 'news', source: src.id, error: err instanceof Error ? err.message : 'Unknown error' }, `Failed to fetch ${src.id}`);
    }
  }

  // Remove duplicates by link
  const unique = Array.from(new Map(articles.map(a => [a.link, a])).values());
  
  // Filter to articles from last 48 hours
  const now = Date.now();
  const recent = unique.filter(a => {
    const published = new Date(a.published).getTime();
    return now - published < 48 * 3600 * 1000;
  });

  // Sort by published date (newest first)
  recent.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());

  // Cache for 12 hours (43200 seconds)
  if (recent.length > 0) {
    await setCache(cacheKey, recent, 43200);
  }

  return recent;
}

const COIN_KEYWORDS: Record<string, string[]> = {
  BTC: ['bitcoin', 'btc'],
  ETH: ['ethereum', 'eth'],
  SOL: ['solana', 'sol'],
  BNB: ['binance', 'bnb', 'binance coin'],
  DOGE: ['dogecoin', 'doge'],
  XRP: ['ripple', 'xrp'],
};

function detectCoins(text: string): string[] {
  const lowerText = text.toLowerCase();
  const detected: string[] = [];

  for (const coin of COINS) {
    const keywords = COIN_KEYWORDS[coin.symbol] || [coin.symbol.toLowerCase()];
    const isMentioned = keywords.some(keyword => lowerText.includes(keyword));
    
    if (isMentioned) {
      detected.push(coin.symbol);
    }
  }

  return detected;
}

export async function fetchCryptoNewsWithSentiment(force = false): Promise<{
  articles: AggregatedNewsArticle[];
  sentimentPerCoin: SentimentPerCoin;
}> {
  const articles = await fetchCryptoNews(force);
  
  // Analyze sentiment for each article
  const articlesWithSentiment: AggregatedNewsArticle[] = [];
  const perCoin: Record<string, { total: number; score: number }> = {};

  for (const article of articles) {
    const text = `${article.title} ${article.description}`;
    
    // Analyze sentiment
    let sentiment;
    try {
      const result = await analyzeSentiment(text);
      sentiment = {
        label: result.label.toUpperCase() as 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL',
        confidence: result.confidence || 0.5,
      };
    } catch (error) {
      logger.error({ service: 'news', action: 'sentiment', error: error instanceof Error ? error.message : 'Unknown error' }, 'Error analyzing sentiment');
      sentiment = { label: 'NEUTRAL' as const, confidence: 0.5 };
    }

    // Detect coins mentioned
    const coins = detectCoins(text);
    
    const articleWithSentiment: AggregatedNewsArticle = {
      ...article,
      sentiment,
      coins,
    };

    articlesWithSentiment.push(articleWithSentiment);

    // Aggregate sentiment per coin
    if (coins.length > 0) {
      for (const coin of coins) {
        if (!perCoin[coin]) {
          perCoin[coin] = { total: 0, score: 0 };
        }

        // Convert sentiment to polarity score
        // POSITIVE = +1, NEGATIVE = -1, NEUTRAL = 0
        const label = sentiment.label.toUpperCase();
        const polarity =
          label === 'POSITIVE' ? 1 :
          label === 'NEGATIVE' ? -1 : 0;

        perCoin[coin].total += 1;
        // Weight by confidence
        perCoin[coin].score += polarity * sentiment.confidence;
      }
    }
  }

  // Compute average sentiment per coin
  const sentimentPerCoin: SentimentPerCoin = {};
  for (const [coin, data] of Object.entries(perCoin)) {
    sentimentPerCoin[coin] = {
      avg: data.total > 0 ? data.score / data.total : 0,
      count: data.total,
      updated: new Date().toISOString(),
    };
  }

  // Store in Redis for dashboard and market integration (12 hours TTL)
  if (Object.keys(sentimentPerCoin).length > 0) {
    await setCache('sentiment:perCoin', sentimentPerCoin, 43200);
    
    // Also store daily history
    const today = new Date().toISOString().slice(0, 10);
    for (const [coin, data] of Object.entries(sentimentPerCoin)) {
      const historyKey = `sentiment:history:${coin}`;
      const history = await getCache(historyKey) || {};
      if (typeof history === 'object') {
        history[today] = data.avg;
        await setCache(historyKey, history, 86400 * 30); // 30 days
      }
    }
  }

  return {
    articles: articlesWithSentiment,
    sentimentPerCoin,
  };
}


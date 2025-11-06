import { XMLParser } from 'fast-xml-parser';
import { normalizeCryptoPanic, normalizeRSS, normalizeCoinGecko, NormalizedNews } from './normalize';

const FETCH_OPTIONS = {
  headers: {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
  signal: AbortSignal.timeout(8000),
} as const;

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
        console.error(`Fetch failed for ${url}:`, error);
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  return null;
}

export async function fetchCryptoPanic(): Promise<{ items: NormalizedNews[]; status: 'ok' | 'error' }> {
  const apiKey = process.env.CRYPTOPANIC_API_KEY || '0dd6eb49e5b72d5af431984ffed73d5a7f98d9ad';
  const plan = process.env.CRYPTOPANIC_PLAN || 'developer';
  
  try {
    const url = `https://cryptopanic.com/api/${plan}/v2/posts/?auth_token=${apiKey}&public=true&size=50&regions=en`;
    const response = await fetchWithRetry(url);
    
    if (!response || !response.ok) {
      return { items: [], status: 'error' };
    }
    
    const data = await response.json();
    const items = (data.results || [])
      .map((item: any) => normalizeCryptoPanic(item))
      .filter((item: NormalizedNews | null): item is NormalizedNews => item !== null);
    
    return { items, status: 'ok' };
  } catch (error) {
    console.error('Error fetching CryptoPanic:', error);
    return { items: [], status: 'error' };
  }
}

export async function fetchCoinDesk(): Promise<{ items: NormalizedNews[]; status: 'ok' | 'error' }> {
  try {
    const url = 'https://www.coindesk.com/arc/outboundfeeds/rss/';
    const response = await fetchWithRetry(url);
    
    if (!response || !response.ok) {
      return { items: [], status: 'error' };
    }
    
    const xmlText = await response.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
    });
    
    const parsed = parser.parse(xmlText);
    const items = (parsed.rss?.channel?.item || [])
      .map((item: any) => normalizeRSS(item, 'CoinDesk'))
      .filter((item: NormalizedNews | null): item is NormalizedNews => item !== null);
    
    return { items, status: 'ok' };
  } catch (error) {
    console.error('Error fetching CoinDesk:', error);
    return { items: [], status: 'error' };
  }
}

export async function fetchCoinTelegraph(): Promise<{ items: NormalizedNews[]; status: 'error' | 'ok' }> {
  try {
    const url = 'https://cointelegraph.com/rss';
    const response = await fetchWithRetry(url);
    
    if (!response || !response.ok) {
      return { items: [], status: 'error' };
    }
    
    const xmlText = await response.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
    });
    
    const parsed = parser.parse(xmlText);
    const items = (parsed.rss?.channel?.item || [])
      .map((item: any) => normalizeRSS(item, 'CoinTelegraph'))
      .filter((item: NormalizedNews | null): item is NormalizedNews => item !== null);
    
    return { items, status: 'ok' };
  } catch (error) {
    console.error('Error fetching CoinTelegraph:', error);
    return { items: [], status: 'error' };
  }
}

export async function fetchCoinGecko(): Promise<{ items: NormalizedNews[]; status: 'ok' | 'error' }> {
  try {
    const url = 'https://api.coingecko.com/api/v3/news';
    const response = await fetchWithRetry(url);
    
    if (!response || !response.ok) {
      return { items: [], status: 'error' };
    }
    
    const data = await response.json();
    const items = (data.data || [])
      .map((item: any) => normalizeCoinGecko(item))
      .filter((item: NormalizedNews | null): item is NormalizedNews => item !== null);
    
    return { items, status: 'ok' };
  } catch (error) {
    console.error('Error fetching CoinGecko:', error);
    return { items: [], status: 'error' };
  }
}


import { XMLParser } from 'fast-xml-parser';

export interface NormalizedNews {
  id: string;
  title: string;
  description?: string;
  url: string;
  published_at: string;
  image?: string;
  source: 'Local News' | 'CoinDesk' | 'CoinTelegraph' | 'CoinGecko';
  instruments?: string[];
  votes?: {
    positive?: number;
    negative?: number;
    important?: number;
    toxic?: number;
  };
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

export function parseInstruments(text: string): string[] {
  const instruments: string[] = [];
  const tickerRegex = /\b(BTC|ETH|SOL|XRP|ADA|DOT|AVAX|MATIC|LINK|UNI|DOGE|SHIB|TRX|ATOM|ALGO|FIL|AAVE|SUSHI|COMP|MKR|YFI|CRV|SNX|BAL|REN|KNC|ZRX|BAT|DAI|USDC|USDT)\b/gi;
  const matches = text.match(tickerRegex);
  if (matches) {
    const unique = [...new Set(matches.map(m => m.toUpperCase()))];
    instruments.push(...unique);
  }
  return instruments;
}

export function stableId(item: { title: string; url: string; source: string }): string {
  const combined = `${item.source}:${normalizeTitle(item.title)}:${item.url}`;
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `news_${Math.abs(hash).toString(36)}`;
}


export function normalizeRSS(item: any, source: 'CoinDesk' | 'CoinTelegraph'): NormalizedNews | null {
  if (!item.title || !item.link) return null;
  
  const description = item.description || item.summary || item.content;
  const instruments = parseInstruments(`${item.title} ${description || ''}`);
  
  const normalized: NormalizedNews = {
    id: stableId({ title: item.title, url: item.link, source }),
    title: item.title.trim(),
    description: description?.replace(/<[^>]*>/g, '').trim(),
    url: item.link.trim(),
    published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    image: item.enclosure?.url || item['media:content']?.['@_url'] || item.image?.href,
    source,
    instruments,
  };
  
  return normalized;
}

export function normalizeCoinGecko(item: any): NormalizedNews | null {
  if (!item.title || !item.url) return null;
  
  const instruments = parseInstruments(`${item.title} ${item.description || ''}`);
  
  const normalized: NormalizedNews = {
    id: stableId({ title: item.title, url: item.url, source: 'CoinGecko' }),
    title: item.title.trim(),
    description: item.description?.trim(),
    url: item.url || item.link,
    published_at: item.updated_at || item.published_at || new Date().toISOString(),
    image: item.thumb_2x || item.thumb,
    source: 'CoinGecko',
    instruments,
  };
  
  return normalized;
}


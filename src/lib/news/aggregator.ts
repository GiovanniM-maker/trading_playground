import { XMLParser } from 'fast-xml-parser';
import { getCache, setCache } from '@/lib/redis';

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
        console.warn(`Failed to fetch ${url}:`, error);
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
        console.warn(`Failed to fetch ${src.id}: HTTP ${response?.status || 'unknown'}`);
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
      console.warn(`Failed to fetch ${src.id}:`, err);
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


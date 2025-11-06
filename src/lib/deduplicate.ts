export interface NewsItem {
  title: string;
  url: string;
  source?: string;
  [key: string]: any;
}

export function deduplicateNews(news: NewsItem[]): NewsItem[] {
  const seen = new Map<string, boolean>();

  return news.filter(item => {
    // Normalize title: lowercase, remove special chars
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (seen.has(key)) {
      return false;
    }
    
    seen.set(key, true);
    return true;
  });
}

// Enhanced deduplication with URL similarity check
export function deduplicateNewsAdvanced(news: NewsItem[]): NewsItem[] {
  const seen = new Map<string, NewsItem>();
  const results: NewsItem[] = [];

  for (const item of news) {
    const titleKey = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const urlKey = new URL(item.url).hostname + new URL(item.url).pathname;
    
    // Check if we've seen this title before
    const existing = seen.get(titleKey);
    
    if (!existing) {
      // New item
      seen.set(titleKey, item);
      results.push(item);
    } else {
      // Duplicate title - prefer items with more complete URLs
      if (urlKey.length > (new URL(existing.url).hostname + new URL(existing.url).pathname).length) {
        // Replace with better URL
        const index = results.indexOf(existing);
        if (index !== -1) {
          results[index] = item;
          seen.set(titleKey, item);
        }
      }
    }
  }

  return results;
}


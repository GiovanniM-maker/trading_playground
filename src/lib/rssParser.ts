// Simple RSS parser for server-side use

export interface RSSItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  image?: string;
}

export function parseRSS(xmlText: string): RSSItem[] {
  const items: RSSItem[] = [];
  
  // Extract items using regex (simpler than full XML parser for server-side)
  const itemMatches = xmlText.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi);
  
  for (const match of itemMatches) {
    const itemContent = match[1];
    
    const titleMatch = itemContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = itemContent.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    const descMatch = itemContent.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
    const pubDateMatch = itemContent.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
    const imageMatch = itemContent.match(/<media:content[^>]*url="([^"]*)"|enclosure[^>]*url="([^"]*)"|image[^>]*href="([^"]*)"/i);
    
    const title = titleMatch?.[1]?.replace(/<[^>]*>/g, '').trim();
    const link = linkMatch?.[1]?.replace(/<[^>]*>/g, '').trim();
    const description = descMatch?.[1]?.replace(/<[^>]*>/g, '').trim();
    const pubDate = pubDateMatch?.[1]?.trim();
    const image = imageMatch?.[1] || imageMatch?.[2] || imageMatch?.[3];
    
    if (title && link) {
      items.push({
        title: decodeHTMLEntities(title),
        link: decodeHTMLEntities(link),
        description: description ? decodeHTMLEntities(description).substring(0, 200) : undefined,
        pubDate,
        image,
      });
    }
  }
  
  return items;
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}


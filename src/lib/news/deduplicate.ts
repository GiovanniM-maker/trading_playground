import { NormalizedNews } from './normalize';
import { embed, cosineSimilarity } from '../embeddings';

const SOURCE_PRIORITY: Record<NormalizedNews['source'], number> = {
  CoinDesk: 4,
  CoinTelegraph: 3,
  'Local News': 2,
  CoinGecko: 1,
};

export async function deduplicateNews(items: NormalizedNews[]): Promise<NormalizedNews[]> {
  if (items.length === 0) return [];
  
  // Sort by published_at desc, then by source priority
  const sorted = [...items].sort((a, b) => {
    const dateDiff = new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    if (dateDiff !== 0) return dateDiff;
    return SOURCE_PRIORITY[b.source] - SOURCE_PRIORITY[a.source];
  });
  
  // Generate embeddings for all items
  const embeddings = new Map<string, Float32Array>();
  const texts = sorted.map(item => `${item.title}. ${item.description || ''}`);
  
  try {
    const embeddingsArray = await Promise.all(
      texts.map(text => embed(text))
    );
    
    sorted.forEach((item, index) => {
      embeddings.set(item.id, embeddingsArray[index]);
    });
  } catch (error) {
    console.error('Error generating embeddings:', error);
    // Fallback to simple title-based deduplication
    return simpleDeduplicate(sorted);
  }
  
  // Deduplicate using cosine similarity
  const leaders: NormalizedNews[] = [];
  const leaderEmbeddings: Float32Array[] = [];
  
  for (const item of sorted) {
    const itemEmbedding = embeddings.get(item.id);
    if (!itemEmbedding) continue;
    
    let isDuplicate = false;
    
    for (let i = 0; i < leaders.length; i++) {
      const similarity = cosineSimilarity(itemEmbedding, leaderEmbeddings[i]);
      
      if (similarity >= 0.88) {
        isDuplicate = true;
        
        // Prefer items with richer URL or higher source priority
        const currentLeader = leaders[i];
        const shouldReplace = 
          SOURCE_PRIORITY[item.source] > SOURCE_PRIORITY[currentLeader.source] ||
          (item.url.length > currentLeader.url.length && item.url !== currentLeader.url);
        
        if (shouldReplace) {
          leaders[i] = item;
          leaderEmbeddings[i] = itemEmbedding;
        }
        break;
      }
    }
    
    if (!isDuplicate) {
      leaders.push(item);
      leaderEmbeddings.push(itemEmbedding);
    }
  }
  
  return leaders;
}

function simpleDeduplicate(items: NormalizedNews[]): NormalizedNews[] {
  const seen = new Set<string>();
  const deduplicated: NormalizedNews[] = [];
  
  for (const item of items) {
    const normalizedTitle = item.title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
    
    if (!seen.has(normalizedTitle)) {
      seen.add(normalizedTitle);
      deduplicated.push(item);
    }
  }
  
  return deduplicated;
}


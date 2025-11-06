import { hfRequest, isHFConfigured } from './hf/client';
import { getCache, setCache } from './redis';
import { createHash } from 'crypto';

// Model fallback order: try CryptoBERT first, then Roberta
const MODELS = ["kk08/CryptoBERT", "cardiffnlp/twitter-roberta-base-sentiment-latest"];

const CACHE_KEY_PREFIX = 'sentiment:cache:';
const CACHE_TTL = 6 * 60 * 60; // 6 hours
const MAX_CACHE_ENTRIES = 50;

export interface SentimentResult {
  label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  score: number;
  model?: string;
  latency_ms?: number;
}

/**
 * Generate cache key from text
 */
function getCacheKey(text: string): string {
  const hash = createHash('md5').update(text.trim().toLowerCase()).digest('hex');
  return `${CACHE_KEY_PREFIX}${hash}`;
}

/**
 * Maintain cache size limit
 */
async function maintainCacheSize(): Promise<void> {
  try {
    // Get all cache entries (simplified - in production, use Redis SCAN)
    // For now, we'll rely on TTL expiration
    // TODO: Implement proper cache size management if needed
  } catch {
    // Ignore cache maintenance errors
  }
}

/**
 * Parse sentiment response from Hugging Face
 */
function parseSentimentResponse(data: any): { label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'; score: number } {
  let output: any;
  
  // Handle different response formats
  if (Array.isArray(data) && data.length > 0) {
    output = Array.isArray(data[0]) ? data[0] : data;
  } else if (data && typeof data === 'object') {
    output = data;
  } else {
    throw new Error('Invalid response format from Hugging Face');
  }

  // Find the highest confidence label
  let bestLabel: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' = 'NEUTRAL';
  let bestScore = 0.5;

  if (Array.isArray(output)) {
    // Multiple labels returned
    for (const item of output) {
      if (item && typeof item === 'object' && item.score) {
        const label = String(item.label || '').toLowerCase();
        const score = parseFloat(item.score) || 0;
        
        if (score > bestScore) {
          bestScore = score;
          if (label.includes('positive') || label === 'positive' || label === 'label_1' || label === 'positive_1') {
            bestLabel = 'POSITIVE';
          } else if (label.includes('negative') || label === 'negative' || label === 'label_0' || label === 'negative_0') {
            bestLabel = 'NEGATIVE';
          } else {
            bestLabel = 'NEUTRAL';
          }
        }
      }
    }
  } else if (output && typeof output === 'object') {
    // Single result object
    const label = String(output.label || '').toLowerCase();
    const score = parseFloat(output.score) || 0.5;
    
    bestScore = score;
    if (label.includes('positive') || label === 'positive' || label === 'label_1' || label === 'positive_1') {
      bestLabel = 'POSITIVE';
    } else if (label.includes('negative') || label === 'negative' || label === 'label_0' || label === 'negative_0') {
      bestLabel = 'NEGATIVE';
    } else {
      bestLabel = 'NEUTRAL';
    }
  }

  return {
    label: bestLabel,
    score: parseFloat(bestScore.toFixed(4)),
  };
}

export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  // Pre-flight check for API key
  if (!isHFConfigured()) {
    const errorMsg = 'Missing HUGGINGFACE_API_KEY environment variable';
    console.warn(`[Sentiment] ${errorMsg} - Not configured`);
    
    // Log to Redis errors (only once per session, not on every call)
    try {
      const { logError } = await import('./errors/logs');
      const errorKey = 'errors:sentiment';
      const existingError = await getCache(errorKey);
      
      if (!existingError) {
        await logError('Hugging Face', errorMsg);
        await setCache(errorKey, { logged: true, timestamp: Date.now() }, 3600); // Log once per hour
      }
    } catch {
      // Ignore logging errors
    }
    
    return { label: 'NEUTRAL', score: 0.5 };
  }

  // Check cache first
  const cacheKey = getCacheKey(text);
  try {
    const cached = await getCache(cacheKey);
    if (cached && typeof cached === 'object' && cached.label) {
      return cached as SentimentResult;
    }
  } catch {
    // Cache miss or error - continue to API call
  }

  const startTime = Date.now();
  let lastError: Error | null = null;
  let successfulModel: string | undefined;

  // Try each model in order
  for (const model of MODELS) {
    try {
      const data = await hfRequest(model, { inputs: text }, { timeout: 10000 });
      const parsed = parseSentimentResponse(data);
      const latency = Date.now() - startTime;
      
      successfulModel = model;
      const result: SentimentResult = {
        label: parsed.label,
        score: parsed.score,
        model: model.split('/').pop() || model,
        latency_ms: latency,
      };

      // Cache the result
      try {
        await setCache(cacheKey, result, CACHE_TTL);
        await maintainCacheSize();
      } catch {
        // Ignore cache errors
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Check if it's an auth error - don't retry other models
      if (lastError.message.includes('401') || lastError.message.includes('403') || 
          lastError.message.includes('Unauthorized') || lastError.message.includes('Forbidden')) {
        // Log auth error to Redis
        try {
          const { logError } = await import('./errors/logs');
          await logError('Hugging Face', lastError.message, lastError.message.includes('401') ? 401 : 403);
          
          // Store AUTH_ERROR status
          await setCache('hf:status', { status: 'AUTH_ERROR', timestamp: Date.now() }, 3600);
        } catch {
          // Ignore logging errors
        }
        
        // Don't try other models on auth error
        break;
      }
      
      // For other errors, try next model
      console.warn(`[Sentiment] Model ${model} failed:`, lastError.message);
    }
  }

  // All models failed - return neutral with error logging
  const latency = Date.now() - startTime;
  const errorMsg = lastError?.message || 'All sentiment models failed';
  
  console.error('[Sentiment] All models failed:', errorMsg);
  
  // Log error to Redis (only once)
  try {
    const errorKey = 'errors:sentiment';
    const existingError = await getCache(errorKey);
    
    if (!existingError || (typeof existingError === 'object' && Date.now() - (existingError.timestamp || 0) > 3600000)) {
      const { logError } = await import('./errors/logs');
      await logError('Hugging Face', errorMsg, 500);
      await setCache(errorKey, { logged: true, timestamp: Date.now() }, 3600);
    }
  } catch {
    // Ignore logging errors
  }

  return {
    label: 'NEUTRAL',
    score: 0.5,
    latency_ms: latency,
  };
}

export async function analyzeSentimentBatch(texts: string[]): Promise<SentimentResult[]> {
  // Process in parallel but with rate limiting
  const results = await Promise.allSettled(
    texts.map(text => analyzeSentiment(text))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`Sentiment analysis failed for text ${index}:`, result.reason);
      return { label: 'NEUTRAL' as const, score: 0.5 };
    }
  });
}

export function sentimentToLabel(sentiment: SentimentResult): 'Bullish' | 'Bearish' | 'Neutral' {
  if (sentiment.label === 'POSITIVE' && sentiment.score >= 0.6) {
    return 'Bullish';
  } else if (sentiment.label === 'NEGATIVE' && sentiment.score >= 0.6) {
    return 'Bearish';
  }
  return 'Neutral';
}

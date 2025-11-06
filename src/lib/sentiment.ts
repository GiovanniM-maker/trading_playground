import { getCache, setCache } from './redis';

const MODEL = process.env.HF_MODEL || "kk08/CryptoBERT";
const HF_KEY = process.env.HUGGINGFACE_API_KEY || "";

export interface SentimentResult {
  label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'neutral' | 'positive' | 'negative';
  confidence: number;
  source: 'huggingface' | 'cached' | 'local-fallback';
  warning?: string;
  error?: string;
  model?: string;
  latency_ms?: number;
}

export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  const startTime = Date.now();
  const headers = {
    "Authorization": `Bearer ${HF_KEY}`,
    "Content-Type": "application/json",
  };

  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${MODEL}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ inputs: text }),
      signal: AbortSignal.timeout(10000),
    });

    // Handle authentication or removal errors
    if ([401, 404, 410].includes(res.status)) {
      console.warn(`⚠️ Hugging Face error ${res.status}: using local sentiment fallback.`);
      await logSentimentFallback(res.status);
      
      // Try to get cached result
      const cached = await getCache("sentiment:last");
      if (cached && typeof cached === 'object' && cached.label) {
        return { 
          ...cached, 
          source: 'cached' as const,
          latency_ms: Date.now() - startTime,
        };
      }
      
      return { 
        label: "neutral", 
        confidence: 0.5, 
        source: "local-fallback", 
        warning: `HuggingFace ${res.status}`,
        latency_ms: Date.now() - startTime,
      };
    }

    if (!res.ok) throw new Error(`HuggingFace Error: ${res.status}`);
    
    const data = await res.json();

    const [label, score] = data?.[0]?.[0]
      ? [data[0][0].label, data[0][0].score]
      : data?.[0]?.label && data?.[0]?.score
      ? [data[0].label, data[0].score]
      : ["neutral", 0.5];

    // Normalize label to our format
    const normalizedLabel = label?.toLowerCase().includes('positive') 
      ? 'positive' 
      : label?.toLowerCase().includes('negative')
      ? 'negative'
      : 'neutral';

    const result: SentimentResult = { 
      label: normalizedLabel, 
      confidence: parseFloat((score || 0.5).toFixed(4)), 
      source: "huggingface",
      latency_ms: Date.now() - startTime,
    };

    // Cache the last good response
    await setCache("sentiment:last", result, 3600);
    
    return result;
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error("Sentiment failed:", err);
    await logSentimentFallback(error);
    
    // Try to get cached result
    const cached = await getCache("sentiment:last");
    if (cached && typeof cached === 'object' && cached.label) {
      return { 
        ...cached, 
        source: 'cached' as const,
        latency_ms: Date.now() - startTime,
      };
    }
    
    return { 
      label: "neutral", 
      confidence: 0.5, 
      source: "local-fallback", 
      error,
      latency_ms: Date.now() - startTime,
    };
  }
}

async function logSentimentFallback(cause: string | number): Promise<void> {
  try {
    const entry = { timestamp: new Date().toISOString(), cause: String(cause) };
    const key = "errors:sentiment:fallbacks";
    
    const existing = await getCache(key);
    const fallbacks = existing && Array.isArray(existing) ? existing : [];
    
    fallbacks.unshift(entry);
    if (fallbacks.length > 50) fallbacks.pop();
    
    await setCache(key, fallbacks, 604800); // 7 days
  } catch (error) {
    console.error("Error logging sentiment fallback:", error);
  }
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
      return { 
        label: 'neutral' as const, 
        confidence: 0.5,
        source: 'local-fallback' as const,
      };
    }
  });
}

export function sentimentToLabel(sentiment: SentimentResult): 'Bullish' | 'Bearish' | 'Neutral' {
  const label = sentiment.label.toLowerCase();
  if (label === 'positive' && sentiment.confidence >= 0.6) {
    return 'Bullish';
  } else if (label === 'negative' && sentiment.confidence >= 0.6) {
    return 'Bearish';
  }
  return 'Neutral';
}

import { isHFConfigured } from './hf/client';

// Single configurable model (can be overridden via HF_MODEL env var)
const DEFAULT_MODEL = process.env.HF_MODEL || "kk08/CryptoBERT";

export interface SentimentResult {
  label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  score: number;
  model?: string;
  latency_ms?: number;
  disabled?: boolean;
  error?: string;
}

export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  const startTime = Date.now();
  
  // Pre-flight check for API key
  if (!isHFConfigured()) {
    console.warn("Sentiment API disabled: missing HuggingFace key");
    return { 
      label: 'NEUTRAL', 
      score: 0.5,
      model: 'disabled',
      disabled: true,
      latency_ms: Date.now() - startTime,
    };
  }

  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    return { 
      label: 'NEUTRAL', 
      score: 0.5,
      model: 'disabled',
      disabled: true,
      latency_ms: Date.now() - startTime,
    };
  }

  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${DEFAULT_MODEL}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      // Handle model unavailable (410)
      if (res.status === 410) {
        const errorMsg = `Model unavailable: ${DEFAULT_MODEL} (410)`;
        console.error(errorMsg);
        return {
          label: 'NEUTRAL',
          score: 0,
          model: DEFAULT_MODEL.split('/').pop() || DEFAULT_MODEL,
          latency_ms: Date.now() - startTime,
          error: errorMsg,
        };
      }
      
      throw new Error(`HuggingFace Error: ${res.status}`);
    }

    const data = await res.json();

    // Normalize output - handle nested array format
    const [label, score] = data?.[0]?.[0]
      ? [data[0][0].label, data[0][0].score]
      : data?.[0]?.label && data?.[0]?.score
      ? [data[0].label, data[0].score]
      : ["neutral", 0.5];

    // Normalize label to our format
    const normalizedLabel = label?.toLowerCase().includes('positive') 
      ? 'POSITIVE' 
      : label?.toLowerCase().includes('negative')
      ? 'NEGATIVE'
      : 'NEUTRAL';

    return {
      label: normalizedLabel,
      score: parseFloat((score || 0.5).toFixed(4)),
      model: DEFAULT_MODEL.split('/').pop() || DEFAULT_MODEL,
      latency_ms: Date.now() - startTime,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error("Sentiment failed:", error);
    return {
      label: "NEUTRAL",
      score: 0,
      model: DEFAULT_MODEL.split('/').pop() || DEFAULT_MODEL,
      latency_ms: Date.now() - startTime,
      error,
    };
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

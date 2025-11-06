const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const MODEL = 'kk08/CryptoBERT';

export interface SentimentResult {
  label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  score: number;
  model?: string;
  latency_ms?: number;
}

export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  // Pre-flight check for API key
  if (!HUGGINGFACE_API_KEY) {
    const errorMsg = 'Missing HUGGINGFACE_API_KEY environment variable';
    console.warn(errorMsg);
    
    // Log to Redis
    try {
      const { logError } = await import('./errors/logs');
      await logError('Hugging Face', errorMsg);
    } catch {
      // Ignore logging errors
    }
    
    return { label: 'NEUTRAL', score: 0.5 };
  }

  const startTime = Date.now();

  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${MODEL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text }),
        signal: AbortSignal.timeout(10000),
      }
    );

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      const errorMsg = `HTTP ${response.status}: ${errorText}`;
      
      console.error(`HuggingFace API error for ${MODEL}:`, errorMsg);
      
      // Log error to Redis
      try {
        const { logError } = await import('./errors/logs');
        await logError('Hugging Face', errorMsg, response.status);
      } catch {
        // Ignore logging errors
      }

      // Handle specific error codes
      if (response.status === 401 || response.status === 403) {
        throw new Error('Authentication failed - check HUGGINGFACE_API_KEY');
      }
      
      if (response.status === 410 || response.status === 404) {
        throw new Error(`Model ${MODEL} is no longer available`);
      }

      throw new Error(errorMsg);
    }

    const data = await response.json();

    // CryptoBERT returns array format: [[{label: "POSITIVE", score: 0.9821}, ...]]
    let output: any;
    
    if (Array.isArray(data) && data.length > 0) {
      output = Array.isArray(data[0]) ? data[0] : data;
    } else if (data && typeof data === 'object') {
      output = data;
    } else {
      throw new Error('Invalid response format from Hugging Face');
    }

    // Find the highest confidence label
    let bestLabel = 'NEUTRAL';
    let bestScore = 0.5;

    if (Array.isArray(output)) {
      // Multiple labels returned
      for (const item of output) {
        if (item && typeof item === 'object' && item.score) {
          const label = String(item.label || '').toLowerCase();
          const score = parseFloat(item.score) || 0;
          
          if (score > bestScore) {
            bestScore = score;
            if (label.includes('positive') || label === 'positive' || label === 'label_1') {
              bestLabel = 'POSITIVE';
            } else if (label.includes('negative') || label === 'negative' || label === 'label_0') {
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
      if (label.includes('positive') || label === 'positive' || label === 'label_1') {
        bestLabel = 'POSITIVE';
      } else if (label.includes('negative') || label === 'negative' || label === 'label_0') {
        bestLabel = 'NEGATIVE';
      } else {
        bestLabel = 'NEUTRAL';
      }
    }

    return {
      label: bestLabel as 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL',
      score: parseFloat(bestScore.toFixed(4)),
      model: MODEL,
      latency_ms: latency,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('Error analyzing sentiment:', errorMsg);
    
    // Log error to Redis
    try {
      const { logError } = await import('./errors/logs');
      await logError('Hugging Face', errorMsg, 500);
    } catch {
      // Ignore logging errors
    }

    return {
      label: 'NEUTRAL',
      score: 0.5,
      model: MODEL,
      latency_ms: latency,
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

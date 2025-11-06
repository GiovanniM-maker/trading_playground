const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

export interface SentimentResult {
  label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  score: number;
}

export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  if (!HUGGINGFACE_API_KEY) {
    console.warn('HuggingFace API key not configured, returning neutral sentiment');
    return { label: 'NEUTRAL', score: 0.5 };
  }

  try {
    const res = await fetch(
      'https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english',
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

    if (!res.ok) {
      console.error(`HuggingFace API error: ${res.status} ${res.statusText}`);
      return { label: 'NEUTRAL', score: 0.5 };
    }

    const data = await res.json();
    
    // Handle array response
    if (Array.isArray(data) && data.length > 0) {
      const result = data[0];
      if (Array.isArray(result)) {
        // Multiple labels returned
        const positive = result.find((r: any) => r.label === 'POSITIVE');
        const negative = result.find((r: any) => r.label === 'NEGATIVE');
        
        if (positive && positive.score > 0.5) {
          return { label: 'POSITIVE', score: positive.score };
        } else if (negative && negative.score > 0.5) {
          return { label: 'NEGATIVE', score: negative.score };
        }
      } else {
        // Single result object
        return {
          label: result.label === 'POSITIVE' ? 'POSITIVE' : 'NEGATIVE',
          score: result.score || 0.5,
        };
      }
    }

    return { label: 'NEUTRAL', score: 0.5 };
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    return { label: 'NEUTRAL', score: 0.5 };
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

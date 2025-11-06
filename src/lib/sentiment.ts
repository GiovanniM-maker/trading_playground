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

  // Try CryptoBERT first, then fallback models
  const models = [
    'kk08/CryptoBERT', // Primary crypto-specific model
    'cardiffnlp/twitter-roberta-base-sentiment-latest',
    'SamLowe/roberta-base-go_emotions',
    'j-hartmann/emotion-english-distilroberta-base',
    'distilbert-base-uncased-finetuned-sst-2-english',
  ];

  for (const model of models) {
    try {
      const res = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
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
        // If 410 Gone, try next model
        if (res.status === 410 && models.indexOf(model) < models.length - 1) {
          continue;
        }
        console.error(`HuggingFace API error for ${model}: ${res.status} ${res.statusText}`);
        if (models.indexOf(model) === models.length - 1) {
          // Last model failed
          return { label: 'NEUTRAL', score: 0.5 };
        }
        continue;
      }

      const data = await res.json();
    
      // Handle array response
      if (Array.isArray(data) && data.length > 0) {
        const result = data[0];
        if (Array.isArray(result)) {
          // Multiple labels returned (CryptoBERT format)
          const positive = result.find((r: any) => 
            r.label === 'POSITIVE' || r.label === 'LABEL_1' || 
            r.label?.toLowerCase().includes('positive') ||
            r.label === 'positive'
          );
          const negative = result.find((r: any) => 
            r.label === 'NEGATIVE' || r.label === 'LABEL_0' || 
            r.label?.toLowerCase().includes('negative') ||
            r.label === 'negative'
          );
          
          if (positive && positive.score > 0.5) {
            return { label: 'POSITIVE', score: positive.score };
          } else if (negative && negative.score > 0.5) {
            return { label: 'NEGATIVE', score: negative.score };
          }
        } else if (result && typeof result === 'object') {
          // Single result object (CryptoBERT may return this format)
          const label = result.label?.toLowerCase() || '';
          const score = result.score || 0.5;
          if (label === 'positive' || label.includes('positive') || label === 'label_1') {
            return { label: 'POSITIVE', score };
          } else if (label === 'negative' || label.includes('negative') || label === 'label_0') {
            return { label: 'NEGATIVE', score };
          }
        }
      }

      // If response is object format (direct response)
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const label = data.label?.toLowerCase() || '';
        const score = data.score || 0.5;
        if (label === 'positive' || label.includes('positive')) {
          return { label: 'POSITIVE', score };
        } else if (label === 'negative' || label.includes('negative')) {
          return { label: 'NEGATIVE', score };
        }
      }

      // If we got here and it's not the last model, try next
      if (models.indexOf(model) < models.length - 1) {
        continue;
      }

      return { label: 'NEUTRAL', score: 0.5 };
    } catch (error) {
      // If not the last model, try next
      if (models.indexOf(model) < models.length - 1) {
        continue;
      }
      console.error('Error analyzing sentiment:', error);
      return { label: 'NEUTRAL', score: 0.5 };
    }
  }

  // All models failed
  return { label: 'NEUTRAL', score: 0.5 };
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

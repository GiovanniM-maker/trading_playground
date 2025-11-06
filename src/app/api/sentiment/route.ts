import { NextResponse } from 'next/server';
import { analyzeSentiment, SentimentResult } from '@/lib/sentiment';
import { logSentiment } from '@/lib/sentiment/logs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface SentimentRequest {
  text: string;
}

interface SentimentResponse {
  label: 'positive' | 'neutral' | 'negative';
  score: number;
  model: string;
  latency_ms: number;
  timestamp: string;
  logId?: string;
}

function convertLabel(label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'): 'positive' | 'neutral' | 'negative' {
  switch (label) {
    case 'POSITIVE':
      return 'positive';
    case 'NEGATIVE':
      return 'negative';
    case 'NEUTRAL':
    default:
      return 'neutral';
  }
}

export async function POST(request: Request) {
  try {
    const body: SentimentRequest = await request.json();

    if (!body.text || typeof body.text !== 'string' || body.text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Limit text length to prevent abuse
    const text = body.text.trim().substring(0, 2000);

    // Analyze sentiment
    const result: SentimentResult = await analyzeSentiment(text);

    // Convert label format
    const label = convertLabel(result.label);
    const score = parseFloat(result.score.toFixed(4)); // Round to 4 decimals

    // Log to Redis
    const logEntry = await logSentiment(text, label, score);

    const response: SentimentResponse = {
      label,
      score,
      model: result.model || 'kk08/CryptoBERT',
      latency_ms: result.latency_ms || 0,
      timestamp: new Date().toISOString(),
      logId: logEntry.id,
    };

    // Add latency header for monitoring
    const nextResponse = NextResponse.json(response);
    if (result.latency_ms) {
      nextResponse.headers.set('X-Latency', result.latency_ms.toString());
    }

    return nextResponse;
  } catch (error) {
    console.error('Error in sentiment API:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Allow GET for health checks
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    model: 'kk08/CryptoBERT',
    message: 'Sentiment analysis API is running',
    timestamp: new Date().toISOString(),
  });
}


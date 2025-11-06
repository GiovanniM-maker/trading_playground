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
    const startTime = Date.now();
    const result: SentimentResult = await analyzeSentiment(text);
    const latency = Date.now() - startTime;

    // Convert label format
    const label = convertLabel(result.label);
    const score = Math.round(result.score * 1000) / 1000; // Round to 3 decimals

    // Log to Redis
    const logEntry = await logSentiment(text, label, score);

    const response: SentimentResponse = {
      label,
      score,
      timestamp: new Date().toISOString(),
      logId: logEntry.id,
    };

    // Add latency header for monitoring
    const nextResponse = NextResponse.json(response);
    nextResponse.headers.set('X-Latency', latency.toString());

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


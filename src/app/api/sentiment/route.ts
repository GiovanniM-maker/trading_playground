import { NextResponse } from 'next/server';
import { analyzeSentiment } from '@/lib/sentiment';
import { saveSentiment } from '@/lib/db';
import { SentimentTextSchema, handleValidationError } from '@/lib/validation';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text, symbol, source } = SentimentTextSchema.parse(body);

    // Limit text length to prevent abuse
    const trimmedText = text.trim().substring(0, 2000);

    // Single call to analyzeSentiment
    const result = await analyzeSentiment(trimmedText);

    // Save to PostgreSQL if symbol is provided
    if (symbol) {
      try {
        await saveSentiment(
          symbol,
          result.confidence || 0.5,
          result.label.toLowerCase() as 'positive' | 'neutral' | 'negative',
          source || 'api'
        );
      } catch (error) {
        // Log but don't fail the request if saving fails
        logger.warn({ service: 'sentiment', operation: 'saveSentiment', symbol, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to save sentiment to database');
      }
    }

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const validationError = handleValidationError(error);
    if (validationError) return validationError;

    logger.error({ service: 'sentiment', error: error instanceof Error ? error.message : 'Unknown error' }, 'Error in sentiment API');
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
  const DEFAULT_MODEL = process.env.HF_MODEL || "kk08/CryptoBERT";
  return NextResponse.json({
    status: 'ok',
    model: DEFAULT_MODEL,
    message: 'Sentiment analysis API is running',
    timestamp: new Date().toISOString(),
  });
}


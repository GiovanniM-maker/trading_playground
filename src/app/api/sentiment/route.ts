import { NextResponse } from 'next/server';
import { analyzeSentiment } from '@/lib/sentiment';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Limit text length to prevent abuse
    const trimmedText = text.trim().substring(0, 2000);

    // Single call to analyzeSentiment
    const result = await analyzeSentiment(trimmedText);

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
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
  const DEFAULT_MODEL = process.env.HF_MODEL || "kk08/CryptoBERT";
  return NextResponse.json({
    status: 'ok',
    model: DEFAULT_MODEL,
    message: 'Sentiment analysis API is running',
    timestamp: new Date().toISOString(),
  });
}


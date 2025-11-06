import { NextResponse } from 'next/server';
import { getSentimentLogs } from '@/lib/sentiment/logs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const logs = await getSentimentLogs(Math.min(limit, 100)); // Max 100

    return NextResponse.json({
      logs,
      count: logs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting sentiment logs:', error);
    return NextResponse.json(
      {
        logs: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}


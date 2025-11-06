import { NextResponse } from 'next/server';
import { getCache } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const fallbacks = await getCache('errors:sentiment:fallbacks');
    
    return NextResponse.json({
      fallbacks: Array.isArray(fallbacks) ? fallbacks : [],
      count: Array.isArray(fallbacks) ? fallbacks.length : 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting sentiment fallbacks:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbacks: [],
        count: 0,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}


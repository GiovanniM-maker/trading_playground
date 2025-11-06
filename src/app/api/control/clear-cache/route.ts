import { NextResponse } from 'next/server';
import { deleteCache } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { keys } = body;

    const results: string[] = [];

    if (keys && Array.isArray(keys)) {
      // Clear specific keys
      for (const key of keys) {
        try {
          await deleteCache(key);
          results.push(`Cleared: ${key}`);
        } catch (error) {
          results.push(`Failed: ${key}`);
        }
      }
    } else {
      // Clear common cache keys
      const cacheKeys = [
        'market_live_prices',
        'market_history_full',
        'news_cache',
        'trades:list',
      ];

      // Clear market caches
      for (const symbol of ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'XRP']) {
        cacheKeys.push(`market:${symbol}`);
        cacheKeys.push(`news_cache:${symbol}`);
      }

      for (const key of cacheKeys) {
        try {
          await deleteCache(key);
          results.push(`Cleared: ${key}`);
        } catch (error) {
          results.push(`Failed: ${key}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully',
      cleared: results.filter(r => r.startsWith('Cleared')).length,
      failed: results.filter(r => r.startsWith('Failed')).length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}


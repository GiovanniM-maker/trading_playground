import { NextResponse } from 'next/server';
import { deleteCache } from '@/lib/redis';
import { stopTradingLoop, startTradingLoop } from '@/lib/tradingLoop';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action } = body;

    const results: string[] = [];

    if (action === 'clear-cache' || !action) {
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

    if (action === 'restart-trading-loop' || !action) {
      try {
        stopTradingLoop();
        await new Promise(resolve => setTimeout(resolve, 500));
        await startTradingLoop();
        results.push('Trading loop restarted');
      } catch (error) {
        results.push('Failed to restart trading loop');
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Server actions completed',
      actions: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in restart API:', error);
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


import { NextResponse } from 'next/server';
import { backfillSymbol, backfillAll, COINS } from '@/lib/history';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { symbols, days = 7, force = false } = body;

    if (symbols && Array.isArray(symbols) && symbols.length > 0) {
      // Backfill specific symbols (parallel)
      const results = await Promise.all(
        symbols.map(async (symbol: string) => {
          try {
            const series = await backfillSymbol(symbol.toUpperCase(), days, force);
            return {
              symbol: series.symbol,
              ok: true,
              points: series.points.length,
              from: new Date(series.from).toISOString(),
              to: new Date(series.to).toISOString(),
              confidence: series.confidence,
              sources_used: series.sources_used,
            };
          } catch (error) {
            return {
              symbol: symbol.toUpperCase(),
              ok: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      );

      return NextResponse.json({
        success: true,
        results,
        days_requested: days,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Backfill all (parallel, optimized)
      const results = await backfillAll(days, force);

      return NextResponse.json({
        success: true,
        results: results.map(r => ({
          symbol: r.symbol,
          ok: r.status === 'ok',
          error: r.error,
        })),
        days_requested: days,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error in backfill API:', error);
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

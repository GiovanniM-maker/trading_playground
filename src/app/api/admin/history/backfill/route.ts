import { NextResponse } from 'next/server';
import { backfillSymbol, backfillAll, COINS } from '@/lib/history';
import { HistoryBackfillSchema, handleValidationError } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const data = HistoryBackfillSchema.parse(body);
    const { symbols, days, force = false } = data;
    // If days is not provided or 0, fetch full history (undefined = all history)
    const daysParam = days && days > 0 ? days : undefined;

    if (symbols && Array.isArray(symbols) && symbols.length > 0) {
      // Backfill specific symbols (parallel)
      const results = await Promise.all(
        symbols.map(async (symbol: string) => {
          try {
            const series = await backfillSymbol(symbol.toUpperCase(), daysParam, force);
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
        days_requested: daysParam || 'all',
        timestamp: new Date().toISOString(),
      });
    } else {
      // Backfill all (parallel, optimized)
      const results = await backfillAll(daysParam, force);

      return NextResponse.json({
        success: true,
        results: results.map(r => ({
          symbol: r.symbol,
          ok: r.status === 'ok',
          error: r.error,
        })),
        days_requested: daysParam || 'all',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    const validationError = handleValidationError(error);
    if (validationError) return validationError;

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

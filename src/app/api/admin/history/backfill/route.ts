import { NextResponse } from 'next/server';
import { backfillSymbol, backfillAll, COINS } from '@/lib/history';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { symbols, force = false } = body;

    if (symbols && Array.isArray(symbols) && symbols.length > 0) {
      // Backfill specific symbols
      const results = await Promise.all(
        symbols.map(async (symbol: string) => {
          try {
            const series = await backfillSymbol(symbol.toUpperCase(), force);
            return {
              symbol: series.symbol,
              ok: true,
              points: series.points.length,
              from: new Date(series.from).toISOString(),
              to: new Date(series.to).toISOString(),
              confidence: series.confidence,
              sources_used: series.sources_used,
              years: Array.from(new Set(series.points.map(p => new Date(p.t).getUTCFullYear()))).sort(),
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
        timestamp: new Date().toISOString(),
      });
    } else {
      // Backfill all
      const results = await backfillAll(force);
      
      // Get detailed info for successful backfills
      const detailed = await Promise.all(
        results.map(async (result) => {
          if (result.ok) {
            try {
              const series = await backfillSymbol(result.symbol, false);
              return {
                ...result,
                points: series.points.length,
                from: new Date(series.from).toISOString(),
                to: new Date(series.to).toISOString(),
                confidence: series.confidence,
                sources_used: series.sources_used,
                years: Array.from(new Set(series.points.map(p => new Date(p.t).getUTCFullYear()))).sort(),
              };
            } catch {
              return result;
            }
          }
          return result;
        })
      );

      return NextResponse.json({
        success: true,
        results: detailed,
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

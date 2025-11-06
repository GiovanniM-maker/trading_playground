import { NextResponse } from 'next/server';
import { refreshHistory, COINS } from '@/lib/history';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { symbols, days = 30, force = false } = body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'symbols array is required',
        },
        { status: 400 }
      );
    }

    if (typeof days !== 'number' || days < 1 || days > 365) {
      return NextResponse.json(
        {
          success: false,
          error: 'days must be a number between 1 and 365',
        },
        { status: 400 }
      );
    }

    // Validate symbols
    const validSymbols = symbols
      .map((s: string) => s.toUpperCase())
      .filter((s: string) => COINS.some(c => c.symbol === s));

    if (validSymbols.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid symbols provided',
        },
        { status: 400 }
      );
    }

    // Refresh each symbol
    const results = await Promise.all(
      validSymbols.map(async (symbol: string) => {
        try {
          const result = await refreshHistory(symbol, days, force);
          return {
            symbol,
            ok: true,
            merged: result.merged,
            total: result.total,
            updated_days: result.updated_days,
          };
        } catch (error) {
          return {
            symbol,
            ok: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    const successful = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        successful,
        failed,
        days_requested: days,
        force,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in refresh API:', error);
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

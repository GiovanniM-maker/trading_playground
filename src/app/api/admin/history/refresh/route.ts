import { NextResponse } from 'next/server';
import { refreshHistory, COINS } from '@/lib/history';
import { HistoryRefreshSchema, handleValidationError } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { symbols, days = 30, force = false } = HistoryRefreshSchema.parse(body);

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

    const successful = results.filter((r: { ok: boolean }) => r.ok).length;
    const failed = results.filter((r: { ok: boolean }) => !r.ok).length;

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
    const validationError = handleValidationError(error);
    if (validationError) return validationError;

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

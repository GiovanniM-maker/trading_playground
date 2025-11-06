import { NextResponse } from 'next/server';
import { loadHistory, sliceRange, COINS } from '@/lib/history';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.toUpperCase() || 'BTC';
    const range = (searchParams.get('range') || 'all') as '24h' | '7d' | '30d' | '90d' | '1y' | '5y' | 'all';

    // Validate symbol
    const validSymbol = COINS.find(c => c.symbol === symbol);
    if (!validSymbol) {
      return NextResponse.json(
        { error: `Invalid symbol: ${symbol}` },
        { status: 400 }
      );
    }

    // Load history
    const series = await loadHistory(symbol);
    
    if (!series) {
      return NextResponse.json(
        {
          error: 'History not found',
          message: `No historical data available for ${symbol}. Please run backfill first.`,
          hint: 'POST /api/admin/history/backfill',
        },
        { status: 404 }
      );
    }

    // Slice by range
    const sliced = sliceRange(series, range);

    return NextResponse.json({
      symbol: sliced.symbol,
      from: sliced.from,
      to: sliced.to,
      points: sliced.points,
      confidence: sliced.confidence,
      sources_used: sliced.sources_used,
      version: sliced.version,
      range,
    });
  } catch (error) {
    console.error('Error in history API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

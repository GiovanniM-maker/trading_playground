import { NextResponse } from 'next/server';
import { loadHistory, COINS } from '@/lib/history';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv'; // csv or json

    // Export all symbols
    const allData: Array<{
      symbol: string;
      date: string;
      timestamp: number;
      price: number;
      confidence: number;
    }> = [];
    
    for (const coin of COINS) {
      const series = await loadHistory(coin.symbol);
      if (series) {
        for (const point of series.points) {
          allData.push({
            symbol: coin.symbol,
            date: new Date(point.t).toISOString().split('T')[0],
            timestamp: point.t,
            price: point.p,
            confidence: point.c,
          });
        }
      }
    }

    // Sort by timestamp
    allData.sort((a, b) => a.timestamp - b.timestamp);

    if (format === 'csv') {
      // CSV format
      const csv = [
        'Symbol,Date,Timestamp,Price (USD),Confidence',
        ...allData.map(p => `${p.symbol},${p.date},${p.timestamp},${p.price},${p.confidence}`)
      ].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="all_crypto_history_${Date.now()}.csv"`,
        },
      });
    } else {
      // JSON format
      return NextResponse.json({
        exported_at: new Date().toISOString(),
        total_points: allData.length,
        symbols: COINS.map(c => c.symbol),
        data: allData,
      });
    }
  } catch (error) {
    console.error('Error in history export API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


import { NextResponse } from 'next/server';
import { getTrades, addTrade, Trade } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '200', 10);

    const trades = await getTrades(limit);

    return NextResponse.json({
      trades,
      count: trades.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching trades:', error);
    return NextResponse.json(
      { trades: [], count: 0, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const trade: Trade = {
      id: body.id || `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      model: body.model,
      symbol: body.symbol,
      side: body.side,
      qty: body.qty,
      price: body.price,
      timestamp: body.timestamp || new Date().toISOString(),
      pnl: body.pnl || 0,
      status: body.status || 'closed',
    };

    await addTrade(trade);

    return NextResponse.json({
      success: true,
      trade,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error adding trade:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


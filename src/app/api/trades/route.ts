import { NextResponse } from 'next/server';
import { getTrades, addTrade, Trade } from '@/lib/db';
import { TradeAPISchema, handleValidationError } from '@/lib/validation';
import { appLogger } from '@/lib/logger';
import { monitorApiResponse } from '@/lib/monitor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '200', 10);

    const trades = await getTrades(limit);
    const duration = Date.now() - startTime;

    const response = NextResponse.json({
      trades,
      count: trades.length,
      timestamp: new Date().toISOString(),
    });

    monitorApiResponse('GET', '/api/trades', 200, duration);
    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    appLogger.error('Error fetching trades', error, { service: 'api', route: 'trades' });
    monitorApiResponse('GET', '/api/trades', 500, duration, error instanceof Error ? error : undefined);
    return NextResponse.json(
      { trades: [], count: 0, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const startTime = Date.now();
  try {
    const body = await request.json();
    const data = TradeAPISchema.parse(body);
    
    const trade: Trade = {
      id: data.id || `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      model: data.model,
      symbol: data.symbol,
      side: data.side,
      qty: data.qty,
      price: data.price,
      timestamp: data.timestamp || new Date().toISOString(),
      pnl: data.pnl || 0,
      status: data.status || 'closed',
    };

    await addTrade(trade);
    const duration = Date.now() - startTime;

    const response = NextResponse.json({
      success: true,
      trade,
      timestamp: new Date().toISOString(),
    });

    monitorApiResponse('POST', '/api/trades', 200, duration);
    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    const validationError = handleValidationError(error);
    if (validationError) {
      monitorApiResponse('POST', '/api/trades', 400, duration);
      return validationError;
    }

    appLogger.error('Error adding trade', error, { service: 'api', route: 'trades' });
    monitorApiResponse('POST', '/api/trades', 500, duration, error instanceof Error ? error : undefined);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


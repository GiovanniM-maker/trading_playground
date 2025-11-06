import { NextResponse } from 'next/server';
import { startTradingLoop, stopTradingLoop, getTradingLoopStatus } from '@/lib/tradingLoop';
import { TradingLoopActionSchema, handleValidationError } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const status = getTradingLoopStatus();
    return NextResponse.json({
      running: status.running,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = TradingLoopActionSchema.parse(body);

    if (action === 'start') {
      await startTradingLoop();
      return NextResponse.json({
        success: true,
        message: 'Trading loop started',
        running: true,
      });
    } else if (action === 'stop') {
      stopTradingLoop();
      return NextResponse.json({
        success: true,
        message: 'Trading loop stopped',
        running: false,
      });
    }
  } catch (error) {
    const validationError = handleValidationError(error);
    if (validationError) return validationError;

    console.error('Error controlling trading loop:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


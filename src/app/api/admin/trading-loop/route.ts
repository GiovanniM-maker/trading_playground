import { NextResponse } from 'next/server';
import { startTradingLoop, stopTradingLoop, getTradingLoopStatus } from '@/lib/tradingLoop';

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
    const { action } = body;

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
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "start" or "stop"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error controlling trading loop:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


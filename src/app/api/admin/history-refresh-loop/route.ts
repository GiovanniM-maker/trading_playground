import { NextResponse } from 'next/server';
import { 
  startHistoryRefreshLoop, 
  stopHistoryRefreshLoop, 
  getHistoryRefreshStatus 
} from '@/lib/historyRefreshLoop';
import { HistoryRefreshLoopActionSchema, handleValidationError } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const status = getHistoryRefreshStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Error getting history refresh loop status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action } = HistoryRefreshLoopActionSchema.parse(body);

    if (action === 'start') {
      await startHistoryRefreshLoop();
      const status = getHistoryRefreshStatus();
      return NextResponse.json({ 
        success: true, 
        running: status.running,
        message: 'History refresh loop started' 
      });
    } else if (action === 'stop') {
      stopHistoryRefreshLoop();
      const status = getHistoryRefreshStatus();
      return NextResponse.json({ 
        success: true, 
        running: status.running,
        message: 'History refresh loop stopped' 
      });
    }
  } catch (error) {
    const validationError = handleValidationError(error);
    if (validationError) return validationError;

    console.error('Error in history refresh loop API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


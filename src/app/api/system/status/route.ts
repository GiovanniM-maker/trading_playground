import { NextResponse } from 'next/server';
import { getSystemStatus } from '@/lib/status';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const status = await getSystemStatus();
    return NextResponse.json(status);
  } catch (error) {
    logger.error({ service: 'api', route: 'system/status', error: error instanceof Error ? error.message : 'Unknown error' }, 'Error getting system status');
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        total_latency: 0,
        services: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


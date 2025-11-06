import { NextResponse } from 'next/server';
import { getSystemStatus } from '@/lib/status';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const status = await getSystemStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Error getting system status:', error);
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


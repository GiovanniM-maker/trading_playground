import { NextResponse } from 'next/server';
import { getControlStatus } from '@/lib/control/status';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const baseUrl = searchParams.get('baseUrl') || '';
    
    // Use Vercel URL if available, otherwise construct from request
    const url = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : baseUrl || (request.headers.get('host') ? `http://${request.headers.get('host')}` : '');

    const status = await getControlStatus(url);
    return NextResponse.json(status);
  } catch (error) {
    console.error('Error getting control status:', error);
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        services: {},
        uptime: 0,
        checked: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


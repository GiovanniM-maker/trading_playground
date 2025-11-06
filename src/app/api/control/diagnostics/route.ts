import { NextResponse } from 'next/server';
import { getControlStatus } from '@/lib/control/status';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const baseUrl = searchParams.get('baseUrl') || '';
    
    const url = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : baseUrl || (request.headers.get('host') ? `http://${request.headers.get('host')}` : '');

    // Run full diagnostics
    const status = await getControlStatus(url);

    return NextResponse.json({
      success: true,
      message: 'Full diagnostics completed',
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error running diagnostics:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}


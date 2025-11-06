import { NextResponse } from 'next/server';
import { appLogger } from '@/lib/logger';
import { monitorError } from '@/lib/monitor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { message, stack, componentStack, timestamp } = body;

    // Log the error
    const error = new Error(message || 'Unknown error');
    if (stack) {
      error.stack = stack;
    }

    appLogger.error('Client-side error caught by ErrorBoundary', error, {
      componentStack,
      timestamp,
      userAgent: request.headers.get('user-agent'),
      url: request.headers.get('referer'),
    });

    // Monitor and alert
    monitorError(error, {
      componentStack,
      source: 'ErrorBoundary',
    }, 'Frontend');

    return NextResponse.json({
      success: true,
      logged: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error logging error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


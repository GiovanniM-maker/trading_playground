import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';

/**
 * Wrapper function to log API requests with latency
 * Usage: export const GET = withApiLogger(async (req) => { ... });
 */
export function withApiLogger(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    // Get start time from middleware header, or use current time
    const startTimeHeader = req.headers.get('x-request-start-time');
    const startTime = startTimeHeader ? parseInt(startTimeHeader, 10) : Date.now();
    const method = req.method;
    const path = new URL(req.url).pathname;
    
    try {
      const response = await handler(req, ...args);
      const latency = Date.now() - startTime;
      
      logger.info({
        service: 'api',
        method,
        path,
        status: response.status,
        latency_ms: latency,
      }, 'API request completed');
      
      return response;
    } catch (error) {
      const latency = Date.now() - startTime;
      
      logger.error({
        service: 'api',
        method,
        path,
        latency_ms: latency,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'API request failed');
      
      throw error;
    }
  };
}

/**
 * Helper to log API request completion from within route handlers
 * Use this when you can't use withApiLogger wrapper
 */
export function logApiRequest(
  req: Request | NextRequest,
  status: number,
  startTime?: number
): void {
  let path: string;
  if (req instanceof Request) {
    path = new URL(req.url).pathname;
  } else {
    path = req.nextUrl.pathname;
  }
  const method = req.method;
  const latency = startTime ? Date.now() - startTime : undefined;
  
  logger.info({
    service: 'api',
    method,
    path,
    status,
    ...(latency !== undefined && { latency_ms: latency }),
  }, 'API request completed');
}


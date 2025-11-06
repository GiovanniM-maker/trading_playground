import { NextResponse } from 'next/server';
import {
  runAllChecks,
  checkRedis,
  checkHuggingFace,
  checkRedisLatency,
  checkVercelEnv,
  checkGitHub,
} from '@/lib/healthChecks';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const service = searchParams.get('service');
    const baseUrl = request.url.replace('/api/health', '');

    // If specific service requested, check only that one
    if (service) {
      let result;
      switch (service) {
        case 'redis':
          result = await checkRedis();
          break;
        case 'huggingface':
          result = await checkHuggingFace();
          break;
        case 'redis-latency':
          result = await checkRedisLatency();
          break;
        case 'vercel-env':
          result = checkVercelEnv();
          break;
        case 'github':
          result = await checkGitHub();
          break;
        default:
          return NextResponse.json({ error: 'Invalid service' }, { status: 400 });
      }
      return NextResponse.json({ result });
    }

    // Run all checks
    const results = await runAllChecks(baseUrl);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


import { NextResponse } from 'next/server';
import { loadHistory, COINS } from '@/lib/history';
import { getCache } from '@/lib/redis';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const statuses = await Promise.all(
      COINS.map(async (coin) => {
        const meta = await getCache(`history:${coin.symbol}:v1:meta`);
        
        if (!meta || typeof meta !== 'object') {
          return {
            symbol: coin.symbol,
            available: false,
            years: [],
            points: 0,
            from: null,
            to: null,
            confidence: null,
            sources_used: [],
            footprint_bytes: 0,
            missing_years: [],
          last_updated: null,
          updated_days: 0,
          };
        }

        const years = (meta.years as number[]) || [];
        const from = meta.from as number;
        const to = meta.to as number;
        const points = meta.points as number;
        const confidence = meta.confidence as number;
        const sources_used = (meta.sources_used as string[]) || [];
      const last_updated = meta.last_updated as number | undefined;
      const updated_days = meta.updated_days as number | undefined;

        // Calculate footprint
        let footprint = 0;
        for (const year of years) {
          const chunk = await getCache(`history:${coin.symbol}:v1:year:${year}`);
          if (typeof chunk === 'string') {
            footprint += Buffer.from(chunk, 'base64').length;
          }
        }

        // Check for missing years (if we expect data from genesis)
        const expectedYears: number[] = [];
        if (from) {
          const startYear = new Date(from).getUTCFullYear();
          const endYear = new Date(to || Date.now()).getUTCFullYear();
          for (let y = startYear; y <= endYear; y++) {
            expectedYears.push(y);
          }
        }
        const missingYears = expectedYears.filter(y => !years.includes(y));

        return {
          symbol: coin.symbol,
          available: true,
          years,
          points,
          from: from ? new Date(from).toISOString() : null,
          to: to ? new Date(to).toISOString() : null,
          confidence,
          sources_used,
          footprint_bytes: footprint,
          missing_years: missingYears,
          last_updated: last_updated ? new Date(last_updated).toISOString() : null,
          updated_days: updated_days || 0,
        };
      })
    );

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      statuses,
    });
  } catch (error) {
    logger.error({ service: 'api', route: 'admin/history/status', error: error instanceof Error ? error.message : 'Unknown error' }, 'Error in history status API');
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

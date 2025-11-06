import { NextResponse } from 'next/server';
import { COINS } from '@/lib/history';
import { getCache, deleteCache } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { confirm } = body;

    if (confirm !== 'DELETE_ALL_HISTORY') {
      return NextResponse.json(
        { error: 'Confirmation required. Send { "confirm": "DELETE_ALL_HISTORY" }' },
        { status: 400 }
      );
    }

    const deleted: string[] = [];
    const errors: string[] = [];

    for (const coin of COINS) {
      const symbol = coin.symbol;
      
      // Get years from meta
      const meta = await getCache(`history:${symbol}:v1:meta`);
      const years = meta && typeof meta === 'object' && Array.isArray(meta.years) 
        ? meta.years as number[]
        : [];

      // Delete all year chunks
      for (const year of years) {
        try {
          await deleteCache(`history:${symbol}:v1:year:${year}`);
          deleted.push(`${symbol}:year:${year}`);
        } catch (error) {
          errors.push(`${symbol}:year:${year}`);
        }
      }

      // Delete metadata
      try {
        await deleteCache(`history:${symbol}:v1:meta`);
        deleted.push(`${symbol}:meta`);
      } catch (error) {
        errors.push(`${symbol}:meta`);
      }
    }

    return NextResponse.json({
      success: true,
      deleted: deleted.length,
      errors: errors.length > 0 ? errors.length : undefined,
      details: {
        deleted_items: deleted,
        errors: errors.length > 0 ? errors : undefined,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in clear-all API:', error);
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


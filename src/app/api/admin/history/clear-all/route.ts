import { NextResponse } from 'next/server';
import { COINS } from '@/lib/history';
import { getCache, deleteCache } from '@/lib/redis';
import { HistoryClearAllSchema, handleValidationError } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    HistoryClearAllSchema.parse(body);

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
    const validationError = handleValidationError(error);
    if (validationError) return validationError;

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


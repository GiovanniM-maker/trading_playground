import { NextResponse } from 'next/server';
import { COINS } from '@/lib/history';
import { getCache, deleteCache } from '@/lib/redis';
import { HistoryClearSchema, handleValidationError } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { symbol } = HistoryClearSchema.parse(body);

    const upperSymbol = symbol.toUpperCase();
    const validSymbol = COINS.find(c => c.symbol === upperSymbol);
    if (!validSymbol) {
      return NextResponse.json(
        { error: `Invalid symbol: ${upperSymbol}` },
        { status: 400 }
      );
    }

    // Get years from meta
    const meta = await getCache(`history:${upperSymbol}:v1:meta`);
    const years = meta && typeof meta === 'object' && Array.isArray(meta.years) 
      ? meta.years as number[]
      : [];

    const deleted: string[] = [];
    const errors: string[] = [];

    // Delete all year chunks
    for (const year of years) {
      try {
        await deleteCache(`history:${upperSymbol}:v1:year:${year}`);
        deleted.push(`year:${year}`);
      } catch (error) {
        errors.push(`year:${year}`);
      }
    }

    // Delete metadata
    try {
      await deleteCache(`history:${upperSymbol}:v1:meta`);
      deleted.push('meta');
    } catch (error) {
      errors.push('meta');
    }

    return NextResponse.json({
      success: true,
      symbol: upperSymbol,
      deleted,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const validationError = handleValidationError(error);
    if (validationError) return validationError;

    console.error('Error in history clear API:', error);
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

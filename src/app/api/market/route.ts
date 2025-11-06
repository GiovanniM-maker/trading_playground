import { NextResponse } from 'next/server';
import { getMarket } from '@/lib/market';
import { getMarket as getCachedMarket, updateMarket } from '@/lib/db';
import { getCoinBySymbol } from '@/lib/market/config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BTC';

    const coin = getCoinBySymbol(symbol);
    if (!coin) {
      return NextResponse.json(
        { error: `Invalid symbol: ${symbol}` },
        { status: 400 }
      );
    }

    // Fetch multi-source market data
    let marketData;
    try {
      marketData = await getMarket(symbol);
    } catch (error) {
      console.error('Error fetching multi-source market data:', error);
      // Fallback to cached/DB data
      const cachedData = await getCachedMarket(symbol);
      if (cachedData) {
        return NextResponse.json({
          ...cachedData,
          coin: {
            id: coin.id,
            name: coin.name,
            color: coin.color,
          },
          fallback: true,
        });
      }
      return NextResponse.json(
        { error: 'Market data not available' },
        { status: 404 }
      );
    }

    // Get historical data from DB if available
    const cachedMarket = await getCachedMarket(symbol);
    const history = cachedMarket?.history || [];

    // Update DB with latest price if needed
    if (marketData && (!cachedMarket || cachedMarket.price !== marketData.price_usd)) {
      await updateMarket(symbol, {
        price: marketData.price_usd,
        change_24h: marketData.change_24h,
        volume_24h: marketData.volume_24h || 0,
        market_cap: marketData.market_cap || 0,
        history: history.length > 0 ? history : [],
      });
    }

    return NextResponse.json({
      ...marketData,
      coin: {
        id: coin.id,
        name: coin.name,
        color: coin.color,
      },
      history: history,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in market API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getLivePrices, getAllHistoricalData } from '@/lib/market/fetch';
import { COINS } from '@/lib/market/config';

// Mark as dynamic route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    // Fetch live prices (no caching - always fresh)
    let livePrices;
    try {
      livePrices = await getLivePrices();
    } catch (error) {
      console.error('Error fetching live prices:', error);
      errors.push('Failed to fetch live prices');
      // Return fallback with zero values
      livePrices = COINS.map(coin => ({
        symbol: coin.symbol,
        name: coin.name,
        price_usd: 0,
        change_24h: 0,
      }));
    }

    // Fetch historical data (cached for 1 hour)
    let history: Record<string, any> = {};
    try {
      const historicalData = await getAllHistoricalData();
      
      // Format historical data for response
      for (const coin of COINS) {
        const data = historicalData[coin.id];
        if (data) {
          history[coin.symbol] = {
            prices: data.prices.map(([timestamp, price]) => [
              new Date(timestamp).toISOString(),
              Math.round(price * 100) / 100,
            ]),
            market_caps: data.market_caps.map(([timestamp, cap]) => [
              new Date(timestamp).toISOString(),
              Math.round(cap),
            ]),
            total_volumes: data.total_volumes.map(([timestamp, volume]) => [
              new Date(timestamp).toISOString(),
              Math.round(volume),
            ]),
          };
        } else {
          history[coin.symbol] = {
            prices: [],
            market_caps: [],
            total_volumes: [],
          };
          errors.push(`Failed to fetch historical data for ${coin.symbol}`);
        }
      }
    } catch (error) {
      console.error('Error fetching historical data:', error);
      errors.push('Failed to fetch historical data');
      
      // Return empty history as fallback
      for (const coin of COINS) {
        history[coin.symbol] = {
          prices: [],
          market_caps: [],
          total_volumes: [],
        };
      }
    }

    const response = {
      timestamp: new Date().toISOString(),
      live: livePrices,
      history,
      ...(errors.length > 0 && { errors, error: true }),
    };

    const responseObj = NextResponse.json(response);
    
    // Cache historical data for 1 hour, but don't cache live prices
    responseObj.headers.set(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=1800'
    );

    return responseObj;
  } catch (error) {
    console.error('Error in markets API:', error);
    
    // Return partial results even on error
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        live: COINS.map(coin => ({
          symbol: coin.symbol,
          name: coin.name,
          price_usd: 0,
          change_24h: 0,
        })),
        history: Object.fromEntries(
          COINS.map(coin => [
            coin.symbol,
            { prices: [], market_caps: [], total_volumes: [] },
          ])
        ),
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


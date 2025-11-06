import { NextResponse } from 'next/server';
import { getMarket, updateMarket } from '@/lib/db';
import { getLivePrices } from '@/lib/market/fetch';
import { COINS, getCoinBySymbol } from '@/lib/market/config';

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

    // Get market data from persistence layer
    let marketData = await getMarket(symbol);

    // If no market data, fetch from CoinGecko and store it
    if (!marketData || !marketData.history || marketData.history.length === 0) {
      try {
        // Fetch live prices
        const livePrices = await getLivePrices();
        const livePrice = livePrices.find(p => p.symbol === symbol);

        if (livePrice && livePrice.price_usd > 0) {
          // Generate history from mock if needed
          const basePrices: Record<string, number> = {
            BTC: 50000,
            ETH: 3000,
            SOL: 140,
            BNB: 600,
            DOGE: 0.15,
            XRP: 0.5,
          };

          const basePrice = basePrices[symbol] || 1000;
          const history: Array<{ time: string; price: number }> = [];
          
          // Generate 90 days of daily history
          for (let i = 90; i >= 0; i--) {
            const time = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString();
            const price = livePrice.price_usd * (0.85 + Math.random() * 0.3);
            history.push({ time, price: Math.round(price * 100) / 100 });
          }

          marketData = {
            symbol,
            price: livePrice.price_usd,
            change_24h: livePrice.change_24h,
            volume_24h: basePrice * (1000000 + Math.random() * 5000000),
            market_cap: basePrice * (10000000 + Math.random() * 50000000),
            history,
          };

          await updateMarket(symbol, marketData);
        }
      } catch (error) {
        console.error('Error fetching market data:', error);
      }
    } else {
      // Update live price if available
      try {
        const livePrices = await getLivePrices();
        const livePrice = livePrices.find(p => p.symbol === symbol);
        
        if (livePrice && livePrice.price_usd > 0) {
          marketData.price = livePrice.price_usd;
          marketData.change_24h = livePrice.change_24h;
          
          // Add latest price point to history
          marketData.history.push({
            time: new Date().toISOString(),
            price: livePrice.price_usd,
          });
          
          // Keep only last 90 days
          const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
          marketData.history = marketData.history.filter(
            point => new Date(point.time).getTime() >= cutoff
          );

          await updateMarket(symbol, marketData);
        }
      } catch (error) {
        console.error('Error updating live price:', error);
      }
    }

    if (!marketData) {
      return NextResponse.json(
        { error: 'Market data not available' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...marketData,
      coin: {
        id: coin.id,
        name: coin.name,
        color: coin.color,
      },
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

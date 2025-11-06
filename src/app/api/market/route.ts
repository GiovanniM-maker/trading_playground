import { NextResponse } from 'next/server';

const COINGECKO_API = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana&order=market_cap_desc&per_page=3&page=1&sparkline=false&price_change_percentage=24h';

interface MarketData {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change_24h: number;
  high_24h: number;
  low_24h: number;
  volume: number;
  market_cap: number;
  updated_at: string;
}

const FALLBACK_DATA: MarketData[] = [
  {
    id: 'bitcoin',
    symbol: 'btc',
    name: 'Bitcoin',
    price: 50000,
    change_24h: 2.5,
    high_24h: 50500,
    low_24h: 49000,
    volume: 32000000000,
    market_cap: 950000000000,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'ethereum',
    symbol: 'eth',
    name: 'Ethereum',
    price: 3000,
    change_24h: -1.2,
    high_24h: 3100,
    low_24h: 2950,
    volume: 12000000000,
    market_cap: 360000000000,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'solana',
    symbol: 'sol',
    name: 'Solana',
    price: 140,
    change_24h: 5.5,
    high_24h: 145,
    low_24h: 135,
    volume: 2000000000,
    market_cap: 60000000000,
    updated_at: new Date().toISOString(),
  },
];

async function fetchWithRetry(url: string, maxRetries = 1): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        next: { revalidate: 60 },
      });

      if (response.status === 429 && attempt < maxRetries) {
        // Rate limited - wait 1 second and retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      return response;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Max retries exceeded');
}

export async function GET() {
  try {
    const response = await fetchWithRetry(COINGECKO_API);

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('CoinGecko rate limit hit, using fallback data');
        return NextResponse.json(FALLBACK_DATA.map(item => ({ ...item, mock: true })));
      }
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform CoinGecko response to our format
    const marketData: MarketData[] = data.map((coin: any) => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      price: coin.current_price,
      change_24h: coin.price_change_percentage_24h || 0,
      high_24h: coin.high_24h,
      low_24h: coin.low_24h,
      volume: coin.total_volume,
      market_cap: coin.market_cap,
      updated_at: coin.last_updated || new Date().toISOString(),
    }));
    
    return NextResponse.json(marketData);
  } catch (error) {
    console.error('Error fetching market data from CoinGecko:', error);
    // Return fallback data with mock flag
    return NextResponse.json(FALLBACK_DATA.map(item => ({ ...item, mock: true })));
  }
}

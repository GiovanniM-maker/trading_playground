import { getCache, setCache } from './redis';
import { COINS, CoinConfig, getCoinBySymbol } from './market/config';

interface MarketData {
  symbol: string;
  price_usd: number;
  change_24h: number;
  market_cap: number | null;
  volume_24h: number | null;
  sources_used: string[];
  consistency_score: number;
  timestamp: string;
}

interface SourceData {
  source: string;
  price: number;
  change_24h: number | null;
  market_cap: number | null;
  volume_24h: number | null;
}

async function fetchGecko(id: string): Promise<SourceData> {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/${id}?localization=false&market_data=true`,
    {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      signal: AbortSignal.timeout(8000),
    }
  );

  if (!response.ok) throw new Error('gecko');

  const data = await response.json();
  return {
    source: 'CoinGecko',
    price: data.market_data.current_price.usd || 0,
    change_24h: data.market_data.price_change_percentage_24h || null,
    market_cap: data.market_data.market_cap?.usd || null,
    volume_24h: data.market_data.total_volume?.usd || null,
  };
}

async function fetchPaprika(symbol: string): Promise<SourceData> {
  // CoinPaprika uses symbol-based IDs in lowercase
  const paprikaId = symbol.toLowerCase();
  const response = await fetch(
    `https://api.coinpaprika.com/v1/tickers/${paprikaId}`,
    {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      signal: AbortSignal.timeout(8000),
    }
  );

  if (!response.ok) throw new Error('paprika');

  const data = await response.json();
  return {
    source: 'CoinPaprika',
    price: data.quotes?.USD?.price || 0,
    change_24h: data.quotes?.USD?.percent_change_24h || null,
    market_cap: data.quotes?.USD?.market_cap || null,
    volume_24h: data.quotes?.USD?.volume_24h || null,
  };
}

async function fetchBinance(symbol: string): Promise<SourceData> {
  const response = await fetch(
    `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`,
    {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      signal: AbortSignal.timeout(8000),
    }
  );

  if (!response.ok) throw new Error('binance');

  const data = await response.json();
  return {
    source: 'Binance',
    price: parseFloat(data.lastPrice) || 0,
    change_24h: parseFloat(data.priceChangePercent) || null,
    market_cap: null,
    volume_24h: parseFloat(data.quoteVolume) || null,
  };
}

async function fetchCompare(symbol: string): Promise<SourceData> {
  const response = await fetch(
    `https://min-api.cryptocompare.com/data/price?fsym=${symbol}&tsyms=USD`,
    {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      signal: AbortSignal.timeout(8000),
    }
  );

  if (!response.ok) throw new Error('compare');

  const data = await response.json();
  return {
    source: 'CryptoCompare',
    price: data.USD || 0,
    change_24h: null,
    market_cap: null,
    volume_24h: null,
  };
}

export async function getMarket(symbol: string): Promise<MarketData> {
  const cacheKey = `market:${symbol}`;
  
  // Check Redis cache first
  const cached = await getCache(cacheKey) as MarketData | null;
  if (cached && cached.timestamp) {
    const cacheAge = Date.now() - new Date(cached.timestamp).getTime();
    if (cacheAge < 300000) { // 5 minutes
      return cached;
    }
  }

  const coin = getCoinBySymbol(symbol);
  if (!coin) {
    throw new Error(`Unknown coin: ${symbol}`);
  }

  // Fetch from all sources in parallel
  const [gecko, paprika, binance, compare] = await Promise.allSettled([
    fetchGecko(coin.id),
    fetchPaprika(coin.symbol),
    fetchBinance(coin.symbol),
    fetchCompare(coin.symbol),
  ]);

  // Extract successful results
  const sources: SourceData[] = [];
  if (gecko.status === 'fulfilled') sources.push(gecko.value);
  if (paprika.status === 'fulfilled') sources.push(paprika.value);
  if (binance.status === 'fulfilled') sources.push(binance.value);
  if (compare.status === 'fulfilled') sources.push(compare.value);

  if (sources.length === 0) {
    throw new Error('No market sources available');
  }

  // Calculate average price and consistency
  const prices = sources.map(s => s.price).filter(p => p > 0);
  if (prices.length === 0) {
    throw new Error('No valid prices from sources');
  }

  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  
  // Calculate variance and consistency score
  const variance = prices.length > 1
    ? Math.sqrt(prices.map(p => Math.pow(p - avgPrice, 2)).reduce((a, b) => a + b, 0) / prices.length)
    : 0;
  
  const consistencyScore = avgPrice > 0 
    ? Math.max(0, Math.min(1, 1 - (variance / avgPrice)))
    : 0;

  // Merge data from all sources
  const merged: MarketData = {
    symbol,
    price_usd: Math.round(avgPrice * 100) / 100,
    change_24h: sources.find(s => s.change_24h !== null)?.change_24h ?? 0,
    market_cap: sources.find(s => s.market_cap !== null)?.market_cap ?? null,
    volume_24h: sources.find(s => s.volume_24h !== null)?.volume_24h ?? null,
    sources_used: sources.map(s => s.source),
    consistency_score: Math.round(consistencyScore * 1000) / 1000,
    timestamp: new Date().toISOString(),
  };

  // Cache in Redis for 5 minutes (300 seconds)
  await setCache(cacheKey, merged, 300);

  return merged;
}

export async function getAllMarkets(): Promise<MarketData[]> {
  return Promise.all(COINS.map(coin => getMarket(coin.symbol)));
}


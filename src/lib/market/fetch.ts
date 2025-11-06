import { COINS, CoinConfig } from './config';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

export interface LivePrice {
  symbol: string;
  name: string;
  price_usd: number;
  change_24h: number;
}

export interface HistoricalData {
  prices: Array<[number, number]>;
  market_caps: Array<[number, number]>;
  total_volumes: Array<[number, number]>;
}

export interface FormattedHistoricalPoint {
  date: string;
  price: number;
  market_cap: number;
  volume: number;
}

async function fetchWithRetry(url: string, maxRetries = 3, delay = 1000, timeout = 30000): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(timeout),
      });

      if (response.status === 429) {
        // Rate limited - wait longer and retry
        const waitTime = delay * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const waitTime = delay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  throw new Error('Max retries exceeded');
}

export async function getLivePrices(): Promise<LivePrice[]> {
  try {
    const url = `${COINGECKO_BASE}/simple/price?ids=${COINS.map(c => c.id).join(',')}&vs_currencies=usd&include_24hr_change=true`;
    const response = await fetchWithRetry(url);
    const data = await response.json();

    const prices: LivePrice[] = COINS.map(coin => {
      const coinData = data[coin.id];
      if (!coinData) {
        return {
          symbol: coin.symbol,
          name: coin.name,
          price_usd: 0,
          change_24h: 0,
        };
      }

      return {
        symbol: coin.symbol,
        name: coin.name,
        price_usd: Math.round((coinData.usd || 0) * 100) / 100,
        change_24h: Math.round((coinData.usd_24h_change || 0) * 100) / 100,
      };
    });

    return prices;
  } catch (error) {
    console.error('Error fetching live prices:', error);
    // Return zero values as fallback
    return COINS.map(coin => ({
      symbol: coin.symbol,
      name: coin.name,
      price_usd: 0,
      change_24h: 0,
    }));
  }
}

export async function getHistoricalData(id: string): Promise<HistoricalData | null> {
  try {
    const url = `${COINGECKO_BASE}/coins/${id}/market_chart?vs_currency=usd&days=max`;
    const response = await fetchWithRetry(url, 2, 2000, 60000); // 60s timeout for large historical datasets
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();

    if (!data.prices || !Array.isArray(data.prices)) {
      return null;
    }

    return {
      prices: data.prices || [],
      market_caps: data.market_caps || [],
      total_volumes: data.total_volumes || [],
    };
  } catch (error) {
    console.error(`Error fetching historical data for ${id}:`, error);
    return null;
  }
}

export async function getAllHistoricalData(): Promise<Record<string, HistoricalData | null>> {
  const results: Record<string, HistoricalData | null> = {};
  
  // Fetch all historical data in parallel
  const promises = COINS.map(async (coin) => {
    const data = await getHistoricalData(coin.id);
    return { id: coin.id, data };
  });

  const settled = await Promise.allSettled(promises);
  
  settled.forEach((result, index) => {
    const coin = COINS[index];
    if (result.status === 'fulfilled') {
      results[coin.id] = result.value.data;
    } else {
      console.error(`Failed to fetch historical data for ${coin.id}:`, result.reason);
      results[coin.id] = null;
    }
  });

  return results;
}


import { getCache, setCache } from './redis';

// In-memory fallback storage
let mockTrades: Trade[] = [];
let mockPortfolios: Record<string, Portfolio> = {};
let mockMarkets: Record<string, Market> = {};

export interface Trade {
  id: string;
  model: string;
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  price: number;
  timestamp: string;
  pnl: number;
  status: 'open' | 'closed';
}

export interface Position {
  symbol: string;
  qty: number;
  avg_price: number;
  pnl: number;
}

export interface Portfolio {
  model: string;
  balance: number;
  positions: Position[];
  last_update: string;
}

export interface Market {
  symbol: string;
  price: number;
  change_24h: number;
  volume_24h: number;
  market_cap: number;
  history: Array<{ time: string; price: number }>;
}

// Check if Redis is available
async function isRedisAvailable(): Promise<boolean> {
  try {
    const testKey = 'redis_health_check';
    await setCache(testKey, { test: true }, 10);
    const result = await getCache(testKey);
    return result !== null;
  } catch {
    return false;
  }
}

export async function getTrades(limit: number = 200): Promise<Trade[]> {
  const redisAvailable = await isRedisAvailable();
  
  if (redisAvailable) {
    try {
      const cached = await getCache('trades:list');
      if (cached && Array.isArray(cached)) {
        return cached.slice(0, limit);
      }
    } catch (error) {
      console.error('Error fetching trades from Redis:', error);
    }
  }

  // Fallback to mock data
  if (mockTrades.length === 0) {
    mockTrades = generateMockTrades(50);
  }
  
  return mockTrades.slice(0, limit);
}

export async function addTrade(trade: Trade): Promise<void> {
  const redisAvailable = await isRedisAvailable();
  
  if (redisAvailable) {
    try {
      const existing = await getCache('trades:list') || [];
      const updated = [trade, ...(existing as Trade[])].slice(0, 1000); // Keep last 1000
      await setCache('trades:list', updated, 0); // No expiration
      return;
    } catch (error) {
      console.error('Error saving trade to Redis:', error);
    }
  }

  // Fallback to mock storage
  mockTrades = [trade, ...mockTrades].slice(0, 1000);
}

export async function getPortfolio(model: string): Promise<Portfolio | null> {
  const redisAvailable = await isRedisAvailable();
  
  if (redisAvailable) {
    try {
      const cached = await getCache(`portfolio:${model}`);
      if (cached) {
        return cached as Portfolio;
      }
    } catch (error) {
      console.error('Error fetching portfolio from Redis:', error);
    }
  }

  // Fallback to mock data
  if (!mockPortfolios[model]) {
    mockPortfolios[model] = generateMockPortfolio(model);
  }
  
  return mockPortfolios[model];
}

export async function updatePortfolio(model: string, data: Partial<Portfolio>): Promise<void> {
  const redisAvailable = await isRedisAvailable();
  
  const existing = await getPortfolio(model);
  const updated: Portfolio = {
    ...(existing || { model, balance: 10000, positions: [], last_update: new Date().toISOString() }),
    ...data,
    last_update: new Date().toISOString(),
  };

  if (redisAvailable) {
    try {
      await setCache(`portfolio:${model}`, updated, 0);
      return;
    } catch (error) {
      console.error('Error updating portfolio in Redis:', error);
    }
  }

  // Fallback to mock storage
  mockPortfolios[model] = updated;
}

export async function getMarket(symbol: string): Promise<Market | null> {
  const redisAvailable = await isRedisAvailable();
  
  if (redisAvailable) {
    try {
      const cached = await getCache(`market:${symbol}`);
      if (cached) {
        return cached as Market;
      }
    } catch (error) {
      console.error('Error fetching market from Redis:', error);
    }
  }

  // Fallback to mock data
  if (!mockMarkets[symbol]) {
    mockMarkets[symbol] = generateMockMarket(symbol);
  }
  
  return mockMarkets[symbol];
}

export async function updateMarket(symbol: string, data: Partial<Market>): Promise<void> {
  const redisAvailable = await isRedisAvailable();
  
  const existing = await getMarket(symbol);
  const updated: Market = {
    ...(existing || generateMockMarket(symbol)),
    ...data,
    symbol,
  };

  if (redisAvailable) {
    try {
      await setCache(`market:${symbol}`, updated, 3600); // Cache for 1 hour
      return;
    } catch (error) {
      console.error('Error updating market in Redis:', error);
    }
  }

  // Fallback to mock storage
  mockMarkets[symbol] = updated;
}

// Mock data generators
function generateMockTrades(count: number): Trade[] {
  const models = ['GPT 5', 'Claude Sonnet', 'Gemini 2.5', 'Grok 4', 'DeepSeek Chat', 'Qwen 3 Max'];
  const symbols = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'XRP'];
  const trades: Trade[] = [];

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString();
    const side = Math.random() > 0.5 ? 'buy' : 'sell';
    const price = 30000 + Math.random() * 50000;
    const qty = Math.random() * 10;
    const pnl = (Math.random() - 0.3) * 1000;

    trades.push({
      id: `trade_${Date.now()}_${i}`,
      model: models[Math.floor(Math.random() * models.length)],
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
      side,
      qty: Math.round(qty * 100) / 100,
      price: Math.round(price * 100) / 100,
      timestamp,
      pnl: Math.round(pnl * 100) / 100,
      status: Math.random() > 0.7 ? 'open' : 'closed',
    });
  }

  return trades.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function generateMockPortfolio(model: string): Portfolio {
  const symbols = ['BTC', 'ETH', 'SOL'];
  const positions: Position[] = symbols.map(symbol => ({
    symbol,
    qty: Math.round((Math.random() * 5) * 100) / 100,
    avg_price: 30000 + Math.random() * 50000,
    pnl: Math.round((Math.random() - 0.3) * 500 * 100) / 100,
  }));

  return {
    model,
    balance: 10000 + Math.random() * 5000,
    positions,
    last_update: new Date().toISOString(),
  };
}

function generateMockMarket(symbol: string): Market {
  const basePrices: Record<string, number> = {
    BTC: 50000,
    ETH: 3000,
    SOL: 140,
    BNB: 600,
    DOGE: 0.15,
    XRP: 0.5,
  };

  const basePrice = basePrices[symbol] || 1000;
  const price = basePrice * (0.95 + Math.random() * 0.1);
  const change_24h = (Math.random() - 0.5) * 10;
  const volume_24h = basePrice * (1000000 + Math.random() * 5000000);
  const market_cap = basePrice * (10000000 + Math.random() * 50000000);

  // Generate 30 days of hourly history
  const history: Array<{ time: string; price: number }> = [];
  for (let i = 30 * 24; i >= 0; i--) {
    const time = new Date(Date.now() - i * 60 * 60 * 1000).toISOString();
    const historicalPrice = basePrice * (0.9 + Math.random() * 0.2);
    history.push({ time, price: Math.round(historicalPrice * 100) / 100 });
  }

  return {
    symbol,
    price: Math.round(price * 100) / 100,
    change_24h: Math.round(change_24h * 100) / 100,
    volume_24h: Math.round(volume_24h),
    market_cap: Math.round(market_cap),
    history,
  };
}


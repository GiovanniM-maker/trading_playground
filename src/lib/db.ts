import { PrismaClient } from '@prisma/client';
import { getCache, setCache } from './redis';
import { logger } from './logger';

// Prisma client instance
export const prisma = new PrismaClient();

// Graceful shutdown
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
}

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
  try {
    // Try Redis cache first for performance
    const redisAvailable = await isRedisAvailable();
    if (redisAvailable) {
      try {
        const cached = await getCache('trades:list');
        if (cached && Array.isArray(cached)) {
          return cached.slice(0, limit);
        }
      } catch (error) {
        logger.warn({ service: 'db', operation: 'getTrades', error: error instanceof Error ? error.message : 'Unknown error' }, 'Error fetching trades from Redis cache');
      }
    }

    // Fetch from PostgreSQL database (source of truth)
    const dbTrades = await prisma.trade.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
    });

    // Convert Prisma model to Trade interface
    const trades: Trade[] = dbTrades.map((t) => ({
      id: t.id,
      model: t.model,
      symbol: t.symbol,
      side: t.side as 'buy' | 'sell',
      qty: t.quantity,
      price: t.priceEntry,
      timestamp: t.timestamp.toISOString(),
      pnl: t.profitLoss,
      status: t.status as 'open' | 'closed',
    }));

    // Cache in Redis for faster subsequent reads
    if (redisAvailable && trades.length > 0) {
      try {
        await setCache('trades:list', trades, 60); // Cache for 1 minute
      } catch (error) {
        logger.warn({ service: 'db', operation: 'getTrades', error: error instanceof Error ? error.message : 'Unknown error' }, 'Error caching trades in Redis');
      }
    }

    return trades;
  } catch (error) {
    logger.error({ service: 'db', operation: 'getTrades', error: error instanceof Error ? error.message : 'Unknown error' }, 'Error fetching trades from database');
    // Return empty array on error (no fallback to in-memory)
    return [];
  }
}

export async function addTrade(trade: Trade): Promise<void> {
  try {
    // Save to PostgreSQL database (persistent storage)
    await prisma.trade.create({
      data: {
        id: trade.id,
        model: trade.model,
        symbol: trade.symbol,
        side: trade.side,
        quantity: trade.qty,
        priceEntry: trade.price,
        priceExit: trade.status === 'closed' ? trade.price : null,
        profitLoss: trade.pnl,
        status: trade.status,
        timestamp: trade.timestamp ? new Date(trade.timestamp) : new Date(),
      },
    });

    // Invalidate Redis cache
    const redisAvailable = await isRedisAvailable();
    if (redisAvailable) {
      try {
        await setCache('trades:list', null, 0); // Invalidate cache
      } catch (error) {
        logger.warn({ service: 'db', operation: 'addTrade', error: error instanceof Error ? error.message : 'Unknown error' }, 'Error invalidating trades cache');
      }
    }
  } catch (error) {
    logger.error({ service: 'db', operation: 'addTrade', error: error instanceof Error ? error.message : 'Unknown error' }, 'Error saving trade to database');
    throw error;
  }
}

export async function getPortfolio(model: string): Promise<Portfolio | null> {
  try {
    // Try Redis cache first
    const redisAvailable = await isRedisAvailable();
    if (redisAvailable) {
      try {
        const cached = await getCache(`portfolio:${model}`);
        if (cached) {
          return cached as Portfolio;
        }
      } catch (error) {
        logger.warn({ service: 'db', operation: 'getPortfolio', error: error instanceof Error ? error.message : 'Unknown error' }, 'Error fetching portfolio from Redis cache');
      }
    }

    // Fetch from PostgreSQL database (persistent storage)
    const dbPortfolio = await prisma.portfolio.findUnique({
      where: { model },
    });

    if (!dbPortfolio) {
      // Return null if not found (caller can handle default)
      return null;
    }

    // Convert to Portfolio interface
    // Positions are stored as JSON in the database
    const positions: Position[] = dbPortfolio.positions 
      ? (Array.isArray(dbPortfolio.positions) ? dbPortfolio.positions as Position[] : [])
      : [];

    const portfolio: Portfolio = {
      model: dbPortfolio.model,
      balance: dbPortfolio.balance,
      positions,
      last_update: dbPortfolio.updatedAt.toISOString(),
    };

    // Cache in Redis
    if (redisAvailable) {
      try {
        await setCache(`portfolio:${model}`, portfolio, 60); // Cache for 1 minute
      } catch (error) {
        logger.warn({ service: 'db', operation: 'getPortfolio', error: error instanceof Error ? error.message : 'Unknown error' }, 'Error caching portfolio in Redis');
      }
    }

    return portfolio;
  } catch (error) {
    logger.error({ service: 'db', operation: 'getPortfolio', error: error instanceof Error ? error.message : 'Unknown error' }, 'Error fetching portfolio from database');
    return null;
  }
}

export async function updatePortfolio(model: string, data: Partial<Portfolio>): Promise<void> {
  try {
    // Update or create in PostgreSQL database (persistent storage)
    await prisma.portfolio.upsert({
      where: { model },
      update: {
        balance: data.balance ?? undefined,
        positions: data.positions ? (data.positions as any) : undefined, // Store positions as JSON
        updatedAt: new Date(),
      },
      create: {
        model,
        balance: data.balance ?? 10000,
        positions: data.positions ? (data.positions as any) : [],
      },
    });

    // Invalidate Redis cache
    const redisAvailable = await isRedisAvailable();
    if (redisAvailable) {
      try {
        await setCache(`portfolio:${model}`, null, 0); // Invalidate cache
      } catch (error) {
        logger.warn({ service: 'db', operation: 'updatePortfolio', error: error instanceof Error ? error.message : 'Unknown error' }, 'Error invalidating portfolio cache');
      }
    }
  } catch (error) {
    logger.error({ service: 'db', operation: 'updatePortfolio', error: error instanceof Error ? error.message : 'Unknown error' }, 'Error updating portfolio in database');
    throw error;
  }
}

// Market data is cache-only (not persisted to PostgreSQL)
export async function getMarket(symbol: string): Promise<Market | null> {
  const redisAvailable = await isRedisAvailable();
  
  if (redisAvailable) {
    try {
      const cached = await getCache(`market:${symbol}`);
      if (cached) {
        return cached as Market;
      }
    } catch (error) {
      logger.warn({ service: 'db', operation: 'getMarket', symbol, error: error instanceof Error ? error.message : 'Unknown error' }, 'Error fetching market from Redis');
    }
  }

  // Return null if not in cache (no in-memory fallback)
  return null;
}

// Market data is cache-only (not persisted to PostgreSQL)
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
    } catch (error) {
      logger.warn({ service: 'db', operation: 'updateMarket', symbol, error: error instanceof Error ? error.message : 'Unknown error' }, 'Error updating market in Redis');
    }
  }
  // No in-memory fallback - Redis is the only cache layer
}

// Sentiment functions - PostgreSQL persistent storage
export async function saveSentiment(
  symbol: string,
  score: number,
  label: 'positive' | 'neutral' | 'negative',
  source: string
): Promise<void> {
  try {
    await prisma.sentiment.create({
      data: {
        symbol, // Changed from 'coin' to 'symbol'
        score,
        label,
        source,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error({ service: 'db', operation: 'saveSentiment', symbol, error: error instanceof Error ? error.message : 'Unknown error' }, 'Error saving sentiment to database');
    throw error;
  }
}

export async function getSentiments(
  symbol?: string,
  limit: number = 100
): Promise<Array<{ id: string; symbol: string; score: number; label: string; source: string; timestamp: Date; createdAt: Date }>> {
  try {
    const where = symbol ? { symbol } : {};
    const sentiments = await prisma.sentiment.findMany({
      where,
      take: limit,
      orderBy: { timestamp: 'desc' },
    });
    return sentiments;
  } catch (error) {
    logger.error({ service: 'db', operation: 'getSentiments', symbol, error: error instanceof Error ? error.message : 'Unknown error' }, 'Error fetching sentiments from database');
    return [];
  }
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



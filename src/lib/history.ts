import { getCache, setCache } from './redis';
import { createHash } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';

export const COINS = [
  { id: 'bitcoin', symbol: 'BTC' },
  { id: 'ethereum', symbol: 'ETH' },
  { id: 'solana', symbol: 'SOL' },
  { id: 'binancecoin', symbol: 'BNB' },
  { id: 'dogecoin', symbol: 'DOGE' },
  { id: 'ripple', symbol: 'XRP' },
];

export function geckoIdFromSymbol(symbol: string): string | undefined {
  return COINS.find(c => c.symbol.toUpperCase() === symbol.toUpperCase())?.id;
}

export function symbolFromGeckoId(id: string): string | undefined {
  return COINS.find(c => c.id === id)?.symbol;
}

export type FusedPoint = {
  t: number; // timestamp (ms, start-of-day UTC)
  p: number; // price
  c: number; // point confidence [0..1]
};

export type FusedSeries = {
  symbol: string;
  from: number;
  to: number;
  points: FusedPoint[];
  sources_used: string[];
  confidence: number;
  version: number;
  checksum: string;
};

type RawPoint = { t: number; p: number };

// Normalize timestamp to UTC midnight
function normalizeToDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

// Fetch from CoinGecko
export async function fetchGeckoHistory(id: string): Promise<RawPoint[]> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=max`,
      {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`);
    
    const data = await response.json();
    if (!data.prices || !Array.isArray(data.prices)) {
      throw new Error('Invalid CoinGecko response');
    }

    return data.prices.map(([t, p]: [number, number]) => ({
      t: normalizeToDay(t),
      p: Math.round(p * 100) / 100,
    }));
  } catch (error) {
    console.error(`Error fetching CoinGecko history for ${id}:`, error);
    throw error;
  }
}

// Fetch from CryptoCompare
export async function fetchCompareHistory(symbol: string): Promise<RawPoint[]> {
  try {
    const response = await fetch(
      `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${symbol}&tsym=USD&allData=true`,
      {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) throw new Error(`CryptoCompare HTTP ${response.status}`);
    
    const data = await response.json();
    if (data.Response === 'Error') {
      throw new Error(data.Message || 'CryptoCompare API error');
    }

    if (!data.Data || !data.Data.Data || !Array.isArray(data.Data.Data)) {
      throw new Error('Invalid CryptoCompare response');
    }

    return data.Data.Data.map((item: any) => ({
      t: normalizeToDay(item.time * 1000), // Convert seconds to ms
      p: Math.round(item.close * 100) / 100,
    }));
  } catch (error) {
    console.error(`Error fetching CryptoCompare history for ${symbol}:`, error);
    throw error;
  }
}

// Fetch from CoinPaprika (optional fallback)
export async function fetchPaprikaHistory(id: string): Promise<RawPoint[] | null> {
  try {
    // CoinPaprika uses symbol-based IDs
    const symbol = symbolFromGeckoId(id);
    if (!symbol) return null;

    const response = await fetch(
      `https://api.coinpaprika.com/v1/tickers/${symbol.toLowerCase()}/historical?start=2013-04-28&limit=5000`,
      {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) return null; // Silently ignore rate limits
    
    const data = await response.json();
    if (!Array.isArray(data)) return null;

    return data.map((item: any) => ({
      t: normalizeToDay(new Date(item.timestamp).getTime()),
      p: Math.round(item.price * 100) / 100,
    }));
  } catch (error) {
    console.warn(`CoinPaprika history fetch failed for ${id}:`, error);
    return null; // Silently ignore
  }
}

// Normalize and deduplicate by day
function normalizeSeries(points: RawPoint[]): RawPoint[] {
  const byDay = new Map<number, number>();
  
  for (const point of points) {
    const day = normalizeToDay(point.t);
    // Keep the last price of the day
    byDay.set(day, point.p);
  }

  return Array.from(byDay.entries())
    .map(([t, p]) => ({ t, p }))
    .sort((a, b) => a.t - b.t);
}

// Fuse multiple sources
export function fuseSources(
  sources: Array<{ name: string; points: RawPoint[] }>
): FusedSeries {
  const validSources = sources.filter(s => s.points.length > 0);
  if (validSources.length === 0) {
    throw new Error('No valid sources provided');
  }

  // Normalize all sources
  const normalized = validSources.map(s => ({
    name: s.name,
    points: normalizeSeries(s.points),
  }));

  // Create union of all dates
  const allDates = new Set<number>();
  for (const source of normalized) {
    for (const point of source.points) {
      allDates.add(point.t);
    }
  }

  const sortedDates = Array.from(allDates).sort((a, b) => a - b);

  // Align and fuse
  const fused: FusedPoint[] = [];
  let totalConfidence = 0;

  for (const date of sortedDates) {
    const prices: number[] = [];
    
    for (const source of normalized) {
      const point = source.points.find(p => p.t === date);
      if (point) {
        prices.push(point.p);
      }
    }

    if (prices.length === 0) continue;

    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    
    // Calculate point confidence
    let pointConfidence: number;
    if (prices.length === 1) {
      pointConfidence = 0.85; // Default for single source
    } else {
      const variance = prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / prices.length;
      const stdev = Math.sqrt(variance);
      pointConfidence = Math.max(0, Math.min(1, 1 - (stdev / avg)));
    }

    totalConfidence += pointConfidence;
    fused.push({
      t: date,
      p: Math.round(avg * 100) / 100,
      c: Math.round(pointConfidence * 1000) / 1000,
    });
  }

  const globalConfidence = fused.length > 0 ? totalConfidence / fused.length : 0;

  // Calculate checksum
  const checksum = createHash('sha256')
    .update(JSON.stringify(fused))
    .digest('hex');

  // Symbol will be set by the caller
  return {
    symbol: '', // Will be overwritten by caller
    from: sortedDates[0],
    to: sortedDates[sortedDates.length - 1],
    points: fused,
    sources_used: validSources.map(s => s.name),
    confidence: Math.round(globalConfidence * 1000) / 1000,
    version: 1,
    checksum: checksum.substring(0, 16), // Short checksum
  };
}

// Save history to Redis (chunked by year)
export async function saveHistory(symbol: string, series: FusedSeries): Promise<void> {
  // Group points by year
  const byYear = new Map<number, FusedPoint[]>();
  
  for (const point of series.points) {
    const year = new Date(point.t).getUTCFullYear();
    if (!byYear.has(year)) {
      byYear.set(year, []);
    }
    byYear.get(year)!.push(point);
  }

  const years = Array.from(byYear.keys()).sort();

  // Save chunks
  for (const year of years) {
    const points = byYear.get(year)!;
    const json = JSON.stringify(points);
    const compressed = gzipSync(json);
    const encoded = Buffer.from(compressed).toString('base64');
    
    const key = `history:${symbol}:v1:year:${year}`;
    await setCache(key, encoded, 0); // No TTL
  }

  // Save metadata
  const meta = {
    symbol,
    years,
    from: series.from,
    to: series.to,
    points: series.points.length,
    confidence: series.confidence,
    sources_used: series.sources_used,
    version: series.version,
    checksum: series.checksum,
  };

  await setCache(`history:${symbol}:v1:meta`, meta, 0);
}

// Load history from Redis
export async function loadHistory(symbol: string): Promise<FusedSeries | null> {
  // Load metadata
  const meta = await getCache(`history:${symbol}:v1:meta`);
  if (!meta || typeof meta !== 'object') {
    return null;
  }

  const years = meta.years as number[];
  if (!Array.isArray(years) || years.length === 0) {
    return null;
  }

  // Load and decompress chunks
  const allPoints: FusedPoint[] = [];
  
  for (const year of years) {
    const encoded = await getCache(`history:${symbol}:v1:year:${year}`);
    if (typeof encoded !== 'string') continue;

    try {
      const compressed = Buffer.from(encoded, 'base64');
      const json = gunzipSync(compressed).toString();
      const points = JSON.parse(json) as FusedPoint[];
      allPoints.push(...points);
    } catch (error) {
      console.error(`Error decompressing chunk for ${symbol} year ${year}:`, error);
    }
  }

  if (allPoints.length === 0) {
    return null;
  }

  // Reconstruct series
  allPoints.sort((a, b) => a.t - b.t);

  return {
    symbol: meta.symbol as string,
    from: meta.from as number,
    to: meta.to as number,
    points: allPoints,
    sources_used: meta.sources_used as string[],
    confidence: meta.confidence as number,
    version: meta.version as number,
    checksum: meta.checksum as string,
  };
}

// Slice series by range
export function sliceRange(
  series: FusedSeries,
  range: '24h' | '7d' | '30d' | '90d' | '1y' | '5y' | 'all'
): FusedSeries {
  if (range === 'all') {
    return series;
  }

  const now = Date.now();
  let cutoff: number;

  switch (range) {
    case '24h':
      cutoff = now - 24 * 60 * 60 * 1000;
      break;
    case '7d':
      cutoff = now - 7 * 24 * 60 * 60 * 1000;
      break;
    case '30d':
      cutoff = now - 30 * 24 * 60 * 60 * 1000;
      break;
    case '90d':
      cutoff = now - 90 * 24 * 60 * 60 * 1000;
      break;
    case '1y':
      cutoff = now - 365 * 24 * 60 * 60 * 1000;
      break;
    case '5y':
      cutoff = now - 5 * 365 * 24 * 60 * 60 * 1000;
      break;
    default:
      return series;
  }

  const filtered = series.points.filter(p => p.t >= cutoff);
  
  if (filtered.length === 0) {
    return series; // Return full if no points in range
  }

  return {
    ...series,
    from: filtered[0].t,
    to: filtered[filtered.length - 1].t,
    points: filtered,
  };
}

// Backfill a single symbol
export async function backfillSymbol(symbol: string, force = false): Promise<FusedSeries> {
  // Check if exists and not forcing
  if (!force) {
    const existing = await loadHistory(symbol);
    if (existing) {
      return existing;
    }
  }

  const id = geckoIdFromSymbol(symbol);
  if (!id) {
    throw new Error(`Unknown symbol: ${symbol}`);
  }

  // Fetch from all sources
  const [gecko, compare, paprika] = await Promise.allSettled([
    fetchGeckoHistory(id).then(points => ({ name: 'CoinGecko', points })),
    fetchCompareHistory(symbol).then(points => ({ name: 'CryptoCompare', points })),
    fetchPaprikaHistory(id).then(points => points ? { name: 'CoinPaprika', points } : null),
  ]);

  const sources: Array<{ name: string; points: RawPoint[] }> = [];
  
  if (gecko.status === 'fulfilled') sources.push(gecko.value);
  if (compare.status === 'fulfilled') sources.push(compare.value);
  if (paprika.status === 'fulfilled' && paprika.value) sources.push(paprika.value);

  if (sources.length === 0) {
    throw new Error(`No sources available for ${symbol}`);
  }

  // Fuse and save
  const fused = fuseSources(sources);
  fused.symbol = symbol; // Ensure correct symbol
  await saveHistory(symbol, fused);

  return fused;
}

// Backfill all symbols
export async function backfillAll(force = false): Promise<Array<{ symbol: string; ok: boolean; error?: string }>> {
  const results: Array<{ symbol: string; ok: boolean; error?: string }> = [];

  for (const coin of COINS) {
    try {
      await backfillSymbol(coin.symbol, force);
      results.push({ symbol: coin.symbol, ok: true });
    } catch (error) {
      results.push({
        symbol: coin.symbol,
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

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

// Normalize timestamps: convert seconds to ms if needed, then round to UTC midnight
function normalizeTimestamps(raw: RawPoint[]): RawPoint[] {
  return raw
    .map(r => ({
      // Convert seconds to milliseconds if needed (< 1e10 means it's in seconds)
      t: r.t < 1e10 ? r.t * 1000 : r.t,
      p: r.p
    }))
    .map(r => ({
      // Round each timestamp to midnight UTC
      t: normalizeToDay(r.t),
      p: r.p
    }))
    .filter(r => r.p > 0) // Remove invalid prices
    .sort((a, b) => a.t - b.t);
}

// Calculate percentile (simple linear interpolation)
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  
  if (lower === upper) return sorted[lower];
  
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

// Sanitize series by removing outliers using Median Absolute Deviation (MAD)
function sanitizeSeries(series: RawPoint[]): RawPoint[] {
  if (series.length === 0) return [];
  
  const prices = series.map(s => s.p).filter(p => p > 0);
  if (prices.length === 0) return [];
  
  // Sort prices for percentile calculation
  const sortedPrices = [...prices].sort((a, b) => a - b);
  const median = percentile(sortedPrices, 50);
  
  // Calculate MAD (Median Absolute Deviation)
  const deviations = prices.map(p => Math.abs(p - median));
  const sortedDeviations = [...deviations].sort((a, b) => a - b);
  const mad = percentile(sortedDeviations, 50);
  
  // Use 6 * MAD as threshold (more conservative than 3-sigma)
  const threshold = 6 * mad;
  const min = median - threshold;
  const max = median + threshold;
  
  return series.filter(s => s.p >= min && s.p <= max && s.p > 0);
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

    // CryptoCompare returns timestamps in seconds, normalizeTimestamps will convert to ms
    return normalizeTimestamps(
      data.Data.Data.map((item: any) => ({
        t: item.time, // Will be converted to ms by normalizeTimestamps
        p: Math.round(item.close * 100) / 100,
      }))
    );
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

    // CoinPaprika returns ISO timestamps, normalize them
    return normalizeTimestamps(
      data.map((item: any) => ({
        t: new Date(item.timestamp).getTime(), // Convert ISO to ms
        p: Math.round(item.price * 100) / 100,
      }))
    );
  } catch (error) {
    console.warn(`CoinPaprika history fetch failed for ${id}:`, error);
    return null; // Silently ignore
  }
}

// Normalize and deduplicate by day
function normalizeSeries(points: RawPoint[]): RawPoint[] {
  // First normalize timestamps
  const normalized = normalizeTimestamps(points);
  
  // Then sanitize outliers
  const sanitized = sanitizeSeries(normalized);
  
  // Deduplicate by day (keep last price of the day)
  const byDay = new Map<number, number>();
  for (const point of sanitized) {
    byDay.set(point.t, point.p);
  }

  return Array.from(byDay.entries())
    .map(([t, p]) => ({ t, p }))
    .sort((a, b) => a.t - b.t);
}

// Fuse multiple sources with CoinGecko as primary reference
export function fuseSources(
  sources: Array<{ name: string; points: RawPoint[] }>
): FusedSeries {
  const validSources = sources.filter(s => s.points.length > 0);
  if (validSources.length === 0) {
    throw new Error('No valid sources provided');
  }

  // Normalize all sources (timestamp normalization + sanitization)
  const normalized = validSources.map(s => ({
    name: s.name,
    points: normalizeSeries(s.points),
  }));

  // Find CoinGecko as primary source
  const geckoSource = normalized.find(s => s.name === 'CoinGecko');
  if (!geckoSource || geckoSource.points.length === 0) {
    // Fallback: if no CoinGecko, use first available source
    const fallback = normalized[0];
    const fused: FusedPoint[] = fallback.points.map(p => ({
      t: p.t,
      p: p.p,
      c: 0.85, // Default confidence for single source
    }));

    const checksum = createHash('sha256')
      .update(JSON.stringify(fused))
      .digest('hex');

    return {
      symbol: '',
      from: fused[0].t,
      to: fused[fused.length - 1].t,
      points: fused,
      sources_used: [fallback.name],
      confidence: 0.85,
      version: 1,
      checksum: checksum.substring(0, 16),
    };
  }

  // Create a map of CoinGecko prices by date for quick lookup
  const geckoPrices = new Map<number, number>();
  for (const point of geckoSource.points) {
    geckoPrices.set(point.t, point.p);
  }

  // Create union of all dates (but prioritize CoinGecko dates)
  const allDates = new Set<number>();
  for (const point of geckoSource.points) {
    allDates.add(point.t);
  }
  // Add dates from other sources only if they're close to CoinGecko dates
  for (const source of normalized) {
    if (source.name === 'CoinGecko') continue;
    for (const point of source.points) {
      // Only include if we have CoinGecko data for this date or nearby dates
      if (geckoPrices.has(point.t)) {
        allDates.add(point.t);
      }
    }
  }

  const sortedDates = Array.from(allDates).sort((a, b) => a - b);

  // Align and fuse with weighted logic
  const fused: FusedPoint[] = [];
  let totalConfidence = 0;

  for (const date of sortedDates) {
    const geckoVal = geckoPrices.get(date);
    
    // Collect prices from all sources, filtering by ±10% of CoinGecko
    const validPrices: Array<{ source: string; price: number }> = [];
    
    if (geckoVal) {
      validPrices.push({ source: 'CoinGecko', price: geckoVal });
    }

    for (const source of normalized) {
      if (source.name === 'CoinGecko') continue;
      
      const point = source.points.find(p => p.t === date);
      if (point) {
        // Only include if within ±10% of CoinGecko (or if no CoinGecko, include all)
        if (geckoVal) {
          const diff = Math.abs(point.p - geckoVal) / geckoVal;
          if (diff < 0.1) {
            validPrices.push({ source: source.name, price: point.p });
          }
        } else {
          // If no CoinGecko for this date, include this source
          validPrices.push({ source: source.name, price: point.p });
        }
      }
    }

    if (validPrices.length === 0) continue;

    // Calculate weighted average (CoinGecko has weight 1.0, others 0.5)
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (const { source, price } of validPrices) {
      const weight = source === 'CoinGecko' ? 1.0 : 0.5;
      weightedSum += price * weight;
      totalWeight += weight;
    }

    const avg = weightedSum / totalWeight;
    
    // Calculate point confidence
    let pointConfidence: number;
    if (validPrices.length === 1) {
      pointConfidence = 0.85; // Default for single source
    } else {
      const prices = validPrices.map(v => v.price);
      const variance = prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / prices.length;
      const stdev = Math.sqrt(variance);
      // Confidence based on coefficient of variation, clamped to [0, 1]
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

  // Collect sources used
  const sourcesUsed = Array.from(new Set(validSources.map(s => s.name)));

  return {
    symbol: '', // Will be overwritten by caller
    from: sortedDates[0],
    to: sortedDates[sortedDates.length - 1],
    points: fused,
    sources_used: sourcesUsed,
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

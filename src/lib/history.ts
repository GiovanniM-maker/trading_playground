import { getCache, setCache } from './redis';
import { createHash } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';
import { fetchWithTimeout } from './utils/fetchWithTimeout';

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

// Import unified timestamp normalization
import { normalizeTimestampUTC, ensureUSDPrice } from './utils/timestamp';

// Normalize timestamp to UTC midnight (kept for backward compatibility)
function normalizeToDay(timestamp: number): number {
  return normalizeTimestampUTC(timestamp);
}

// Normalize timestamps: convert seconds to ms if needed, then round to UTC midnight
async function normalizeTimestamps(raw: RawPoint[]): Promise<RawPoint[]> {
  // Normalize timestamps and ensure USD prices
  const normalized = await Promise.all(
    raw.map(async (r) => {
      const normalizedTs = normalizeTimestampUTC(r.t);
      const usdPrice = await ensureUSDPrice(r.p, 'USD'); // Ensure USD
      
      return {
        t: normalizedTs,
        p: usdPrice,
      };
    })
  );
  
  return normalized
    .filter(r => r.p > 0) // Remove invalid prices
    .sort((a, b) => a.t - b.t); // Ensure ascending order
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

// Fetch from CoinGecko (supports both limited range and full history)
export async function fetchGeckoHistory(id: string, days?: number): Promise<RawPoint[] | null> {
  let url: string;
  
  if (days && days > 0) {
    // Limited range for refresh operations
    const now = Math.floor(Date.now() / 1000);
    const from = now - days * 86400;
    url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=usd&from=${from}&to=${now}`;
  } else {
    // Full history for initial backfill
    url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=max`;
  }
  
  const response = await fetchWithTimeout(url, 30000, { // 30s timeout for full history
    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
  });

  if (!response) {
    return null;
  }

  try {
    const data = await response.json();
    if (!data.prices || !Array.isArray(data.prices)) {
      return null;
    }

    // CoinGecko returns timestamps in milliseconds and prices in USD
    const normalized = await normalizeTimestamps(
      data.prices.map(([t, p]: [number, number]) => ({
        t,
        p: Math.round(p * 100) / 100, // Round to 2 decimals
      }))
    );

    if (normalized.length > 0) {
      const range = days ? `${days} days` : 'full history';
      console.log(`[CoinGecko ${id}] Fetched ${normalized.length} points (${range})`);
    }

    return normalized;
  } catch (error) {
    console.error(`Error parsing CoinGecko response for ${id}:`, error);
    return null;
  }
}

// Fetch from CryptoCompare (supports both limited range and full history)
export async function fetchCompareHistory(symbol: string, days?: number): Promise<RawPoint[] | null> {
  let url: string;
  
  if (days && days > 0) {
    // Limited range for refresh operations
    const now = Math.floor(Date.now() / 1000);
    url = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${symbol}&tsym=USD&limit=${days}&toTs=${now}`;
  } else {
    // Full history for initial backfill
    url = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${symbol}&tsym=USD&allData=true`;
  }
  
  const response = await fetchWithTimeout(url, 30000, { // 30s timeout for full history
    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
  });

  if (!response) {
    return null;
  }

  try {
    const data = await response.json();
    if (data.Response === 'Error') {
      return null;
    }

    if (!data.Data || !data.Data.Data || !Array.isArray(data.Data.Data)) {
      return null;
    }

    // CryptoCompare returns timestamps in seconds and prices in USD
    const normalized = await normalizeTimestamps(
      data.Data.Data.map((item: any) => ({
        t: item.time, // Will be converted to ms by normalizeTimestamps
        p: Math.round(item.close * 100) / 100, // Round to 2 decimals, already in USD
      }))
    );

    if (normalized.length > 0) {
      const range = days ? `${days} days` : 'full history';
      console.log(`[CryptoCompare ${symbol}] Fetched ${normalized.length} points (${range})`);
    }

    return normalized;
  } catch (error) {
    console.error(`Error parsing CryptoCompare response for ${symbol}:`, error);
    return null;
  }
}

// Fetch from CoinPaprika (supports both limited range and full history)
export async function fetchPaprikaHistory(id: string, days?: number): Promise<RawPoint[] | null> {
  const symbol = symbolFromGeckoId(id);
  if (!symbol) return null;

  let url: string;
  
  if (days && days > 0) {
    // Limited range for refresh operations
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    url = `https://api.coinpaprika.com/v1/tickers/${symbol.toLowerCase()}/historical?start=${startStr}&limit=${days * 2}`;
  } else {
    // Full history for initial backfill (start from Bitcoin genesis: 2013-04-28)
    url = `https://api.coinpaprika.com/v1/tickers/${symbol.toLowerCase()}/historical?start=2013-04-28&limit=5000`;
  }
  
  const response = await fetchWithTimeout(url, 30000, { // 30s timeout for full history
    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
  });

  if (!response) {
    return null;
  }

  try {
    const data = await response.json();
    if (!Array.isArray(data)) {
      return null;
    }

    // CoinPaprika returns ISO timestamps and prices in USD
    const normalized = await normalizeTimestamps(
      data.map((item: any) => ({
        t: new Date(item.timestamp).getTime(), // Convert ISO to ms
        p: Math.round((item.price || item.quotes?.USD?.price || 0) * 100) / 100, // Ensure USD price
      }))
    );

    if (normalized.length > 0) {
      const range = days ? `${days} days` : 'full history';
      console.log(`[CoinPaprika ${symbol}] Fetched ${normalized.length} points (${range})`);
    }

    return normalized;
  } catch (error) {
    console.warn(`CoinPaprika history fetch failed for ${id}:`, error);
    return null;
  }
}

// Normalize and deduplicate by day
async function normalizeSeries(points: RawPoint[]): Promise<RawPoint[]> {
  // First normalize timestamps and ensure USD
  const normalized = await normalizeTimestamps(points);
  
  // Then sanitize outliers
  const sanitized = sanitizeSeries(normalized);
  
  // Deduplicate by day (keep last price of the day)
  const byDay = new Map<number, number>();
  for (const point of sanitized) {
    byDay.set(point.t, point.p);
  }

  const result = Array.from(byDay.entries())
    .map(([t, p]) => ({ t, p }))
    .sort((a, b) => a.t - b.t); // Ensure ascending order

  return result;
}

// Fuse multiple sources with CoinGecko as primary reference
export async function fuseSources(
  sources: Array<{ name: string; points: RawPoint[] }>
): Promise<FusedSeries> {
  const validSources = sources.filter(s => s.points.length > 0);
  if (validSources.length === 0) {
    throw new Error('No valid sources provided');
  }

  // Normalize all sources (timestamp normalization + sanitization + USD conversion)
  const normalized = await Promise.all(
    validSources.map(async (s) => ({
      name: s.name,
      points: await normalizeSeries(s.points),
    }))
  );

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

  // Final verification: ensure sorted ascending
  fused.sort((a, b) => a.t - b.t);

  // Verification logging
  if (fused.length > 0) {
    const min = Math.min(...fused.map(p => p.p));
    const max = Math.max(...fused.map(p => p.p));
    const sample = fused.slice(0, 3);
    const latest = fused[fused.length - 1];
    console.log(`[Fused Series] Points: ${fused.length}, price range: $${min.toFixed(2)} - $${max.toFixed(2)}, latest: $${latest.p.toFixed(2)} at ${new Date(latest.t).toISOString()}, sample:`, sample);
  }

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

// Save history to Redis (optimized with conditional compression and checksum skip)
export async function saveHistory(
  symbol: string,
  series: FusedSeries,
  updateInfo?: { updated_days?: number },
  force = false
): Promise<void> {
  // Check if data is unchanged (skip write if checksum matches and not forcing)
  if (!force) {
    const existingMeta = await getCache(`history:${symbol}:v1:meta`);
    if (existingMeta && typeof existingMeta === 'object') {
      const existingChecksum = existingMeta.checksum as string | undefined;
      if (existingChecksum === series.checksum) {
        console.log(`[Save ${symbol}] Skipping write - checksum unchanged`);
        return;
      }
    }
  }

  // Calculate days span for compression decision
  const daysSpan = (series.to - series.from) / (1000 * 60 * 60 * 24);
  const shouldCompress = daysSpan >= 30;

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

  // Save chunks (with conditional compression)
  for (const year of years) {
    const points = byYear.get(year)!;
    const json = JSON.stringify(points);
    
    let encoded: string;
    if (shouldCompress) {
      const compressed = gzipSync(json);
      encoded = Buffer.from(compressed).toString('base64');
    } else {
      // For short ranges (<30d), store as plain JSON (faster)
      encoded = json;
    }
    
    const key = `history:${symbol}:v1:year:${year}`;
    await setCache(key, encoded, 0); // No TTL
  }

  // Load existing metadata to preserve last_updated if exists
  const existingMeta = await getCache(`history:${symbol}:v1:meta`);
  const previousLastUpdated = existingMeta && typeof existingMeta === 'object' 
    ? (existingMeta.last_updated as number | undefined)
    : undefined;

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
    last_updated: Date.now(),
    updated_days: updateInfo?.updated_days || existingMeta?.updated_days || 0,
    compressed: shouldCompress,
  };

  await setCache(`history:${symbol}:v1:meta`, meta, 0);
  console.log(`[Save ${symbol}] Saved ${series.points.length} points${shouldCompress ? ' (compressed)' : ''}`);
}

// Load history from Redis (handles both compressed and uncompressed)
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

  const isCompressed = meta.compressed as boolean | undefined;

  // Load and decompress chunks
  const allPoints: FusedPoint[] = [];
  
  for (const year of years) {
    const encoded = await getCache(`history:${symbol}:v1:year:${year}`);
    if (typeof encoded !== 'string') continue;

    try {
      let points: FusedPoint[];
      
      if (isCompressed) {
        // Decompress if compressed
        const compressed = Buffer.from(encoded, 'base64');
        const json = gunzipSync(compressed).toString();
        points = JSON.parse(json) as FusedPoint[];
      } else {
        // Direct parse if not compressed
        points = JSON.parse(encoded) as FusedPoint[];
      }
      
      allPoints.push(...points);
    } catch (error) {
      console.error(`Error loading chunk for ${symbol} year ${year}:`, error);
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

// Backfill a single symbol (optimized with early return on first successful source)
// If days is undefined or 0, fetches full history
export async function backfillSymbol(
  symbol: string,
  days?: number,
  force = false
): Promise<FusedSeries> {
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

  // Try sources in order with early return on first success
  const sources = [
    { name: 'CoinGecko', fn: () => fetchGeckoHistory(id, days) },
    { name: 'CryptoCompare', fn: () => fetchCompareHistory(symbol, days) },
    { name: 'CoinPaprika', fn: () => fetchPaprikaHistory(id, days) },
  ];

  let lastError: Error | null = null;

  for (const source of sources) {
    try {
      console.log(`[Backfill ${symbol}] Trying ${source.name}...`);
      const points = await source.fn();
      
      if (points && points.length > 0) {
      // Convert to FusedSeries format
      const fused: FusedSeries = {
        symbol,
        from: points[0].t,
        to: points[points.length - 1].t,
        points: points.map(p => ({ t: p.t, p: p.p, c: 1.0 })),
        sources_used: [source.name],
        confidence: 1.0,
        version: 1,
        checksum: createHash('sha256')
          .update(JSON.stringify(points.map(p => ({ t: p.t, p: p.p, c: 1.0 }))))
          .digest('hex')
          .substring(0, 16),
      };

      // Smart merge: if data exists, merge instead of overwrite
      if (!force) {
        const existing = await loadHistory(symbol);
        if (existing && existing.points.length > 0) {
          // Merge with existing data (don't overwrite existing points)
          const existingMap = new Map<number, FusedPoint>();
          for (const point of existing.points) {
            existingMap.set(point.t, point);
          }
          
          // Add new points (only if timestamp doesn't exist)
          let mergedCount = 0;
          for (const point of fused.points) {
            if (!existingMap.has(point.t)) {
              existingMap.set(point.t, point);
              mergedCount++;
            }
          }
          
          const mergedPoints = Array.from(existingMap.values()).sort((a, b) => a.t - b.t);
          
          // Update fused series with merged data
          fused.points = mergedPoints;
          fused.from = mergedPoints[0].t;
          fused.to = mergedPoints[mergedPoints.length - 1].t;
          
          // Recalculate checksum
          fused.checksum = createHash('sha256')
            .update(JSON.stringify(mergedPoints.map(p => ({ t: p.t, p: p.p, c: p.c }))))
            .digest('hex')
            .substring(0, 16);
          
          console.log(`[Backfill ${symbol}] Merged ${mergedCount} new points with ${existing.points.length} existing`);
        }
      }

      await saveHistory(symbol, fused, undefined, force);
      
      // Log the backfill
      await logHistoryUpdate(symbol, {
        action: 'backfill',
        points: fused.points.length,
        from: fused.from,
        to: fused.to,
        source: source.name,
        timestamp: Date.now(),
      });

      console.log(`[Backfill ${symbol}] ✅ Success using ${source.name}, ${fused.points.length} points`);
      return fused;
      }
    } catch (error) {
      console.error(`[Backfill ${symbol}] ❌ ${source.name} failed:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continue to next source
    }
  }

  const errorMsg = lastError 
    ? `No valid data available for ${symbol} from any source. Last error: ${lastError.message}`
    : `No valid data available for ${symbol} from any source`;
  throw new Error(errorMsg);
}

// Refresh history for a symbol (fetch last N days from CoinGecko and merge)
export async function refreshHistory(
  symbol: string,
  days: number,
  force = false
): Promise<{ merged: number; total: number; updated_days: number }> {
  const id = geckoIdFromSymbol(symbol);
  if (!id) {
    throw new Error(`Unknown symbol: ${symbol}`);
  }

  // Load existing history
  const existing = await loadHistory(symbol);
  
  // Create backup before modifications (always backup if existing data)
  if (existing) {
    const backupKey = `history:${symbol}:v1:backup:${Date.now()}`;
    const backupMeta = {
      symbol: existing.symbol,
      from: existing.from,
      to: existing.to,
      points: existing.points.length,
      confidence: existing.confidence,
      sources_used: existing.sources_used,
      version: existing.version,
      checksum: existing.checksum,
      backup_timestamp: Date.now(),
      force_flag: force,
    };
    await setCache(backupKey, backupMeta, 0);
  }

  try {
    // Fetch last N days from CoinGecko using optimized function
    const newRawPoints = await fetchGeckoHistory(id, days);
    
    if (!newRawPoints || newRawPoints.length === 0) {
      throw new Error(`No data available from CoinGecko for ${symbol}`);
    }

    // Points are already normalized from fetchGeckoHistory
    const newPoints: FusedPoint[] = newRawPoints.map(p => ({
      t: p.t,
      p: p.p,
      c: 1.0,
    }));

    // Merge with existing data
    let mergedPoints: FusedPoint[];
    let merged = 0;

    if (existing && existing.points.length > 0) {
      // Create a map of existing points by timestamp
      const existingMap = new Map<number, FusedPoint>();
      for (const point of existing.points) {
        existingMap.set(point.t, point);
      }

      // Merge new points (overwrite if exists, add if new)
      for (const newPoint of newPoints) {
        if (existingMap.has(newPoint.t)) {
          existingMap.set(newPoint.t, newPoint); // Update with new data
          merged++;
        } else {
          existingMap.set(newPoint.t, newPoint); // Add new point
          merged++;
        }
      }

      mergedPoints = Array.from(existingMap.values()).sort((a, b) => a.t - b.t);
    } else {
      // No existing data, use new points only
      mergedPoints = newPoints.sort((a, b) => a.t - b.t);
      merged = newPoints.length;
    }

    // Calculate updated days (unique dates)
    const updatedDaysSet = new Set<string>();
    for (const point of newPoints) {
      const date = new Date(point.t);
      const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
      updatedDaysSet.add(dateStr);
    }
    const updatedDays = updatedDaysSet.size;

    // Create merged series
    const mergedSeries: FusedSeries = {
      symbol,
      from: mergedPoints[0].t,
      to: mergedPoints[mergedPoints.length - 1].t,
      points: mergedPoints,
      sources_used: ['CoinGecko'],
      confidence: 1.0,
      version: 1,
      checksum: createHash('sha256')
        .update(JSON.stringify(mergedPoints))
        .digest('hex')
        .substring(0, 16),
    };

    await saveHistory(symbol, mergedSeries, { updated_days: updatedDays });

    // Log the refresh
    await logHistoryUpdate(symbol, {
      action: 'refresh',
      days_requested: days,
      points_merged: merged,
      points_total: mergedPoints.length,
      updated_days: updatedDays,
      timestamp: Date.now(),
    });

    return {
      merged,
      total: mergedPoints.length,
      updated_days: updatedDays,
    };
  } catch (error) {
    console.error(`Error refreshing history for ${symbol}:`, error);
    throw error;
  }
}

// Log history updates to Redis
async function logHistoryUpdate(
  symbol: string,
  update: {
    action: string;
    points?: number;
    points_merged?: number;
    points_total?: number;
    days_requested?: number;
    updated_days?: number;
    from?: number;
    to?: number;
    source?: string;
    timestamp: number;
  }
): Promise<void> {
  try {
    const logKey = 'logs:history_updates';
    const existingLogs = await getCache(logKey);
    const logs = Array.isArray(existingLogs) ? existingLogs : [];
    
    logs.push({
      symbol,
      ...update,
      timestamp: update.timestamp,
    });

    // Keep only last 1000 entries
    if (logs.length > 1000) {
      logs.shift();
    }

    await setCache(logKey, logs, 0);
  } catch (error) {
    console.error('Error logging history update:', error);
    // Don't throw - logging is non-critical
  }
}

// Backfill all symbols (parallel fetching)
// If days is undefined or 0, fetches full history for all symbols
export async function backfillAll(
  days?: number,
  force = false
): Promise<Array<{ symbol: string; status: string; error?: string }>> {
  const symbols = COINS.map(c => c.symbol);
  
  // Fetch all in parallel
  const jobs = symbols.map(symbol => 
    backfillSymbol(symbol, days, force)
      .then(() => ({ symbol, status: 'ok' as const }))
      .catch(error => ({
        symbol,
        status: 'error' as const,
        error: error instanceof Error ? error.message : 'Unknown error',
      }))
  );

  const results = await Promise.allSettled(jobs);
  
  return results.map((r, i) => {
    if (r.status === 'fulfilled') {
      return r.value;
    } else {
      return {
        symbol: symbols[i],
        status: 'error' as const,
        error: r.reason?.message || 'Unknown error',
      };
    }
  });
}

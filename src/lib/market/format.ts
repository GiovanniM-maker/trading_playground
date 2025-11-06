import { HistoricalData, FormattedHistoricalPoint } from './fetch';

export interface FormattedData {
  date: string;
  price: number;
  market_cap: number;
  volume: number;
}

export interface TrendStats {
  change_percent: number;
  change_absolute: number;
  first_price: number;
  last_price: number;
  first_date: string;
  last_date: string;
}

export function formatHistoricalData(data: HistoricalData | null): FormattedData[] {
  if (!data || !data.prices || data.prices.length === 0) {
    return [];
  }

  const formatted: FormattedData[] = [];
  const prices = data.prices || [];
  const marketCaps = data.market_caps || [];
  const volumes = data.total_volumes || [];

  // Find the maximum length to iterate through all data points
  const maxLength = Math.max(prices.length, marketCaps.length, volumes.length);

  for (let i = 0; i < maxLength; i++) {
    const pricePoint = prices[i] || [0, 0];
    const marketCapPoint = marketCaps[i] || [0, 0];
    const volumePoint = volumes[i] || [0, 0];

    // Use the timestamp from the price point (or market cap or volume if price doesn't exist)
    const timestamp = pricePoint[0] || marketCapPoint[0] || volumePoint[0];
    
    formatted.push({
      date: new Date(timestamp).toISOString(),
      price: Math.round(pricePoint[1] * 100) / 100,
      market_cap: Math.round(marketCapPoint[1]),
      volume: Math.round(volumePoint[1]),
    });
  }

  return formatted;
}

export function computeTrendStats(data: FormattedData[]): TrendStats | null {
  if (data.length === 0) return null;

  const first = data[0];
  const last = data[data.length - 1];

  const change_absolute = last.price - first.price;
  const change_percent = first.price > 0 
    ? (change_absolute / first.price) * 100 
    : 0;

  return {
    change_percent: Math.round(change_percent * 100) / 100,
    change_absolute: Math.round(change_absolute * 100) / 100,
    first_price: first.price,
    last_price: last.price,
    first_date: first.date,
    last_date: last.date,
  };
}

export function resampleData(
  data: FormattedData[],
  interval: 'day' | 'week' | 'month'
): FormattedData[] {
  if (data.length === 0) return [];

  const intervalMs = {
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
  }[interval];

  const resampled: FormattedData[] = [];
  let currentBucket: FormattedData[] = [];
  let bucketStart = new Date(data[0].date).getTime();

  for (const point of data) {
    const pointTime = new Date(point.date).getTime();
    
    if (pointTime >= bucketStart + intervalMs) {
      // Save current bucket
      if (currentBucket.length > 0) {
        const avg = averageBucket(currentBucket);
        resampled.push(avg);
      }
      
      // Start new bucket
      currentBucket = [point];
      bucketStart = pointTime;
    } else {
      currentBucket.push(point);
    }
  }

  // Add the last bucket
  if (currentBucket.length > 0) {
    const avg = averageBucket(currentBucket);
    resampled.push(avg);
  }

  return resampled;
}

function averageBucket(bucket: FormattedData[]): FormattedData {
  const sum = bucket.reduce(
    (acc, point) => ({
      price: acc.price + point.price,
      market_cap: acc.market_cap + point.market_cap,
      volume: acc.volume + point.volume,
    }),
    { price: 0, market_cap: 0, volume: 0 }
  );

  const count = bucket.length;
  const last = bucket[bucket.length - 1];

  return {
    date: last.date,
    price: Math.round((sum.price / count) * 100) / 100,
    market_cap: Math.round(sum.market_cap / count),
    volume: Math.round(sum.volume / count),
  };
}

export function filterByDateRange(
  data: FormattedData[],
  days: number
): FormattedData[] {
  if (days === 0 || data.length === 0) return data;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffTime = cutoffDate.getTime();

  return data.filter(point => new Date(point.date).getTime() >= cutoffTime);
}


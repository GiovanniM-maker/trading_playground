/**
 * Normalize timestamp to UTC midnight
 * Handles both string and number inputs, converts seconds to ms if needed
 */
export function normalizeTimestampUTC(ts: number | string): number {
  // Convert string to number if needed
  const t = typeof ts === 'string' ? Date.parse(ts) : ts;
  
  // Convert seconds to milliseconds if needed (< 1e10 means it's in seconds)
  const timestamp = t < 1e10 ? t * 1000 : t;
  
  // Round to UTC midnight
  const d = new Date(timestamp);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMilliseconds(0);
  
  return d.getTime();
}

/**
 * Get EUR to USD conversion rate (fallback)
 * In production, this should be fetched from an API
 */
export async function getEURToUSDRate(): Promise<number> {
  try {
    // Try to get from CoinGecko
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd,eur',
      {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000),
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      const ethUsd = data.ethereum?.usd;
      const ethEur = data.ethereum?.eur;
      
      if (ethUsd && ethEur && ethEur > 0) {
        return ethUsd / ethEur;
      }
    }
  } catch (error) {
    console.warn('Failed to fetch EUR/USD rate, using default:', error);
  }
  
  // Fallback: approximate rate (should be updated regularly)
  return 1.08; // Approximate EUR/USD rate
}

/**
 * Convert price to USD, handling multiple currencies
 */
export async function ensureUSDPrice(
  price: number,
  currency: 'USD' | 'EUR' | 'USDT' = 'USD'
): Promise<number> {
  if (currency === 'USD') {
    return price;
  }
  
  if (currency === 'USDT') {
    // USDT is pegged to USD, but may have slight variations
    // For historical data accuracy, treat as 1:1
    return price;
  }
  
  if (currency === 'EUR') {
    const rate = await getEURToUSDRate();
    return price * rate;
  }
  
  return price; // Default: assume USD
}


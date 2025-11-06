import { getCache, setCache } from './redis';

interface ServiceStatus {
  name: string;
  status: 'OK' | 'ERROR' | 'WARNING';
  latency: number;
  code?: number;
  json?: any;
  error?: string;
  lastUpdate?: string;
}

interface SystemStatus {
  timestamp: string;
  total_latency: number;
  services: ServiceStatus[];
}

async function checkAPI(name: string, url: string): Promise<ServiceStatus> {
  const t0 = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    const latency = Math.round(performance.now() - t0);
    const ok = res.ok;
    
    let json: any = {};
    try {
      const text = await res.text();
      if (text) {
        json = JSON.parse(text);
      }
    } catch {
      // Not JSON, ignore
    }

    return {
      name,
      status: ok ? 'OK' : 'ERROR',
      latency,
      code: res.status,
      json,
      lastUpdate: new Date().toISOString(),
    };
  } catch (e: any) {
    const latency = Math.round(performance.now() - t0);
    return {
      name,
      status: 'ERROR',
      latency,
      json: {},
      error: e.message || 'Request failed',
      lastUpdate: new Date().toISOString(),
    };
  }
}

async function checkRedis(): Promise<ServiceStatus> {
  const redisPingStart = performance.now();
  let status: 'OK' | 'ERROR' = 'ERROR';
  let error: string | undefined;
  
  try {
    const testKey = `health_check_${Date.now()}`;
    await setCache(testKey, { test: true }, 10);
    const result = await getCache(testKey);
    
    if (result) {
      status = 'OK';
    } else {
      error = 'Failed to read/write test key';
    }
  } catch (e: any) {
    error = e.message || 'Redis connection failed';
  }
  
  const latency = Math.round(performance.now() - redisPingStart);
  
  return {
    name: 'Redis',
    status,
    latency,
    json: status === 'OK' ? { connected: true } : { error },
    error,
    lastUpdate: new Date().toISOString(),
  };
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const start = Date.now();

  const [gecko, paprika, binance, compare, redis] = await Promise.allSettled([
    checkAPI('CoinGecko', 'https://api.coingecko.com/api/v3/ping'),
    checkAPI('CoinPaprika', 'https://api.coinpaprika.com/v1/global'),
    checkAPI('Binance', 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'),
    checkAPI('CryptoCompare', 'https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD'),
    checkRedis(),
  ]);

  const services: ServiceStatus[] = [
    gecko.status === 'fulfilled' ? gecko.value : { name: 'CoinGecko', status: 'ERROR', latency: 0, error: 'Check failed' },
    paprika.status === 'fulfilled' ? paprika.value : { name: 'CoinPaprika', status: 'ERROR', latency: 0, error: 'Check failed' },
    binance.status === 'fulfilled' ? binance.value : { name: 'Binance', status: 'ERROR', latency: 0, error: 'Check failed' },
    compare.status === 'fulfilled' ? compare.value : { name: 'CryptoCompare', status: 'ERROR', latency: 0, error: 'Check failed' },
    redis.status === 'fulfilled' ? redis.value : { name: 'Redis', status: 'ERROR', latency: 0, error: 'Check failed' },
  ];

  return {
    timestamp: new Date().toISOString(),
    total_latency: Date.now() - start,
    services,
  };
}


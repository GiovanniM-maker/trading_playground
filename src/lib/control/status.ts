import { checkRedis, checkCryptoPanic, checkHuggingFace, checkMarketAPI, checkNewsAPI, checkRedisLatency, checkVercelEnv, checkGitHub, HealthCheckResult } from '../healthChecks';
import { logEvent, LogEntry } from './logs';

export interface ServiceStatus {
  name: string;
  status: 'OK' | 'ERROR' | 'WARNING';
  latency: number;
  code?: number;
  json?: any;
  error?: string;
  lastUpdate?: string;
  logs?: LogEntry[];
}

export interface ControlStatus {
  timestamp: string;
  services: Record<string, ServiceStatus>;
  uptime: number;
  checked: number;
}

async function checkAPIWithLogging(name: string, url: string): Promise<ServiceStatus> {
  const start = performance.now();
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
    const latency = Math.round(performance.now() - start);
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

    const status: ServiceStatus = {
      name,
      status: ok ? 'OK' : 'ERROR',
      latency,
      code: res.status,
      json,
      lastUpdate: new Date().toISOString(),
    };

    // Log the event
    await logEvent(name, {
      timestamp: Date.now(),
      status: ok ? 'OK' : 'ERROR',
      code: res.status,
      latency,
      json: Object.keys(json).length > 0 ? json : undefined,
    });

    return status;
  } catch (e: any) {
    const latency = Math.round(performance.now() - start);
    const status: ServiceStatus = {
      name,
      status: 'ERROR',
      latency,
      json: {},
      error: e.message || 'Request failed',
      lastUpdate: new Date().toISOString(),
    };

    // Log the error
    await logEvent(name, {
      timestamp: Date.now(),
      status: 'ERROR',
      latency,
      message: e.message || 'Request failed',
    });

    return status;
  }
}

export async function getControlStatus(baseUrl: string = ''): Promise<ControlStatus> {
  const start = Date.now();
  
  // Check all services in parallel
  const [
    gecko,
    paprika,
    binance,
    compare,
    redisHealth,
    redisLatency,
    cryptopanic,
    huggingface,
    market,
    news,
    vercelEnv,
    github,
  ] = await Promise.allSettled([
    checkAPIWithLogging('CoinGecko', 'https://api.coingecko.com/api/v3/ping'),
    checkAPIWithLogging('CoinPaprika', 'https://api.coinpaprika.com/v1/global'),
    checkAPIWithLogging('Binance', 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'),
    checkAPIWithLogging('CryptoCompare', 'https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD'),
    checkRedis(),
    checkRedisLatency(),
    checkCryptoPanic(),
    checkHuggingFace(),
    checkMarketAPI(baseUrl),
    checkNewsAPI(baseUrl),
    checkVercelEnv(),
    checkGitHub(),
  ]);

  // Convert health check results to service statuses
  const services: Record<string, ServiceStatus> = {};

  // API services
  if (gecko.status === 'fulfilled') {
    services['CoinGecko'] = gecko.value;
  }
  if (paprika.status === 'fulfilled') {
    services['CoinPaprika'] = paprika.value;
  }
  if (binance.status === 'fulfilled') {
    services['Binance'] = binance.value;
  }
  if (compare.status === 'fulfilled') {
    services['CryptoCompare'] = compare.value;
  }

  // Health check services
  const healthChecks: Array<{ name: string; result: HealthCheckResult | null }> = [
    { name: 'Redis', result: redisHealth.status === 'fulfilled' ? redisHealth.value : null },
    { name: 'Redis Latency', result: redisLatency.status === 'fulfilled' ? redisLatency.value : null },
    { name: 'CryptoPanic', result: cryptopanic.status === 'fulfilled' ? cryptopanic.value : null },
    { name: 'Hugging Face', result: huggingface.status === 'fulfilled' ? huggingface.value : null },
    { name: 'Market API', result: market.status === 'fulfilled' ? market.value : null },
    { name: 'News API', result: news.status === 'fulfilled' ? news.value : null },
    { name: 'Vercel Environment', result: vercelEnv.status === 'fulfilled' ? vercelEnv.value : null },
    { name: 'GitHub Sync', result: github.status === 'fulfilled' ? github.value : null },
  ];

  for (const { name, result } of healthChecks) {
    if (result) {
      services[name] = {
        name,
        status: result.status === 'ok' ? 'OK' : result.status === 'warning' ? 'WARNING' : 'ERROR',
        latency: result.latency,
        code: undefined,
        error: result.status !== 'ok' ? result.message : undefined,
        lastUpdate: new Date(result.timestamp).toISOString(),
      };

      // Log the event
      await logEvent(name, {
        timestamp: result.timestamp,
        status: result.status === 'ok' ? 'OK' : result.status === 'warning' ? 'WARNING' : 'ERROR',
        latency: result.latency,
        message: result.message,
      });
    }
  }

  // Calculate uptime (percentage of services that are OK)
  const serviceValues = Object.values(services);
  const okCount = serviceValues.filter(s => s.status === 'OK').length;
  const uptime = serviceValues.length > 0 ? okCount / serviceValues.length : 0;

  // Load logs for each service
  const { getLogs } = await import('./logs');
  for (const serviceName of Object.keys(services)) {
    const logs = await getLogs(serviceName);
    services[serviceName].logs = logs;
  }

  return {
    timestamp: new Date().toISOString(),
    services,
    uptime: Math.round(uptime * 1000) / 10, // Percentage with 1 decimal
    checked: serviceValues.length,
  };
}


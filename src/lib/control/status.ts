import { checkRedis, checkHuggingFace, checkNewsAggregator, checkRedisLatency, checkVercelEnv, checkGitHub, HealthCheckResult } from '../healthChecks';
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
  errorCount?: number;
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
  // Check sentiment API with actual inference test
  const sentimentCheck = await Promise.allSettled([
    (async () => {
      const start = performance.now();
      try {
        const url = `${baseUrl || 'http://localhost:3000'}/api/sentiment`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for inference
        
        // Test with actual sentiment analysis
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: 'Bitcoin is surging today!' }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        const latency = Math.round(performance.now() - start);
        
        let json: any = {};
        try {
          const text = await res.text();
          if (text) {
            json = JSON.parse(text);
          }
        } catch {
          // Not JSON, ignore
        }

        // Check if API key is missing
        if (res.status === 401 || res.status === 403) {
          const { logEvent } = await import('./logs');
          await logEvent('Sentiment API', {
            timestamp: Date.now(),
            status: 'ERROR',
            latency,
            message: `Authentication failed (${res.status})`,
          });
        }

        return {
          name: 'Sentiment API',
          status: (res.ok ? 'OK' : 'ERROR') as 'OK' | 'ERROR',
          latency,
          code: res.status,
          json: {
            ...json,
            model: json.model || 'kk08/CryptoBERT',
            latency_ms: json.latency_ms || latency,
          },
          lastUpdate: new Date().toISOString(),
        };
      } catch (e: any) {
        const latency = Math.round(performance.now() - start);
        const errorMsg = e.message || 'Request failed';
        
        // Log error
        try {
          const { logEvent } = await import('./logs');
          await logEvent('Sentiment API', {
            timestamp: Date.now(),
            status: 'ERROR',
            latency,
            message: errorMsg,
          });
        } catch {
          // Ignore logging errors
        }
        
        return {
          name: 'Sentiment API',
          status: 'ERROR' as const,
          latency,
          json: {},
          error: errorMsg,
          lastUpdate: new Date().toISOString(),
        };
      }
    })(),
  ]);

  const [
    gecko,
    paprika,
    binance,
    compare,
    redisHealth,
    redisLatency,
    huggingface,
    newsAggregator,
    vercelEnv,
    github,
  ] = await Promise.allSettled([
    checkAPIWithLogging('CoinGecko', 'https://api.coingecko.com/api/v3/ping'),
    checkAPIWithLogging('CoinPaprika', 'https://api.coinpaprika.com/v1/global'),
    checkAPIWithLogging('Binance', 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'),
    checkAPIWithLogging('CryptoCompare', 'https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD'),
    checkRedis(),
    checkRedisLatency(),
    checkHuggingFace(),
    checkNewsAggregator(baseUrl),
    checkVercelEnv(),
    checkGitHub(),
  ]);

  // Convert health check results to service statuses
  const services: Record<string, ServiceStatus> = {};

  // Unified Sentiment System check (merges Sentiment API and Hugging Face)
  const sentimentResult = sentimentCheck[0].status === 'fulfilled' ? sentimentCheck[0].value : null;
  const huggingFaceResult = huggingface.status === 'fulfilled' ? huggingface.value : null;

  // Merge Sentiment API and Hugging Face into single "Sentiment System" card
  if (sentimentResult || huggingFaceResult) {
    // Prefer sentiment API result, fallback to Hugging Face check
    const result = sentimentResult || {
      name: 'Sentiment System',
      status: huggingFaceResult?.status === 'ok' ? 'OK' : huggingFaceResult?.status === 'warning' ? 'WARNING' : 'ERROR',
      latency: huggingFaceResult?.latency || 0,
      code: undefined,
      json: {
        model: huggingFaceResult?.details?.model || process.env.HF_MODEL || 'kk08/CryptoBERT',
        status: huggingFaceResult?.details?.status || 'UNKNOWN',
      },
      error: huggingFaceResult?.message,
      lastUpdate: new Date(huggingFaceResult?.timestamp || Date.now()).toISOString(),
    };

    const finalStatus: 'OK' | 'ERROR' | 'WARNING' = 
      (result.status === 'OK' || (typeof result.status === 'string' && result.status.toLowerCase() === 'ok')) ? 'OK' :
      (result.status === 'ERROR' || (typeof result.status === 'string' && result.status.toLowerCase() === 'error')) ? 'ERROR' :
      'WARNING';
    
    services['Sentiment System'] = {
      name: 'Sentiment System',
      status: finalStatus,
      latency: result.latency || 0,
      code: result.code,
      json: {
        ...result.json,
        model: result.json?.model || process.env.HF_MODEL || 'kk08/CryptoBERT',
        source: result.json?.source || 'unknown', // Include source from sentiment API response
      },
      error: result.error,
      lastUpdate: result.lastUpdate,
    };

    // Log the event
    await logEvent('Sentiment System', {
      timestamp: Date.now(),
      status: finalStatus,
      latency: result.latency || 0,
      message: result.error || (result.json?.model ? `OK - ${result.json.model}` : 'OK'),
    });
  }

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

  // Health check services (excluding Hugging Face - merged into Sentiment System above)
  const healthChecks: Array<{ name: string; result: HealthCheckResult | null }> = [
    { name: 'Redis', result: redisHealth.status === 'fulfilled' ? redisHealth.value : null },
    { name: 'Redis Latency', result: redisLatency.status === 'fulfilled' ? redisLatency.value : null },
    { name: 'News System', result: newsAggregator.status === 'fulfilled' ? newsAggregator.value : null },
    { name: 'Vercel Environment', result: vercelEnv.status === 'fulfilled' ? vercelEnv.value : null },
    { name: 'GitHub Sync', result: github.status === 'fulfilled' ? github.value : null },
  ];

  for (const { name, result } of healthChecks) {
    if (result) {
      const status: 'OK' | 'ERROR' | 'WARNING' = result.status === 'ok' ? 'OK' : result.status === 'warning' ? 'WARNING' : 'ERROR';
      
      services[name] = {
        name,
        status,
        latency: result.latency,
        code: undefined,
        error: result.status !== 'ok' ? result.message : undefined,
        lastUpdate: new Date(result.timestamp).toISOString(),
        json: result.details || {}, // Include details for News System (count, cached, lastUpdate)
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
  const { getErrorCountByService } = await import('../errors/logs');
  
  const errorCounts = await getErrorCountByService();
  
  for (const serviceName of Object.keys(services)) {
    const logs = await getLogs(serviceName);
    services[serviceName].logs = logs;
    
    // Add error count to service status
    if (errorCounts[serviceName]) {
      services[serviceName].errorCount = errorCounts[serviceName];
    }
  }

  return {
    timestamp: new Date().toISOString(),
    services,
    uptime: Math.round(uptime * 1000) / 10, // Percentage with 1 decimal
    checked: serviceValues.length,
  };
}


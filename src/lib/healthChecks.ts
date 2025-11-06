export interface HealthCheckResult {
  service: string;
  status: 'ok' | 'warning' | 'error';
  latency: number;
  message: string;
  timestamp: number;
  details?: any;
}

const TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Helper for retry with exponential backoff
async function fetchWithRetryHelper(url: string, options: RequestInit = {}, maxRetries = 2, timeout = TIMEOUT_MS): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        // Retry on 5xx errors
        if (response.status >= 500 && response.status < 600 && attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

export async function checkRedis(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!url || !token) {
      return {
        service: 'Redis',
        status: 'error',
        latency: 0,
        message: 'Missing environment variables',
        timestamp: Date.now(),
      };
    }

    // Test SET operation
    const testKey = `health-check-${Date.now()}`;
    const testValue = 'ok';
    
    const setResponse = await fetchWithTimeout(
      `${url}/set/${testKey}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testValue),
      }
    );

    if (!setResponse.ok) {
      throw new Error(`Redis SET failed: ${setResponse.status}`);
    }

    // Test GET operation
    const getResponse = await fetchWithTimeout(
      `${url}/get/${testKey}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!getResponse.ok) {
      throw new Error(`Redis GET failed: ${getResponse.status}`);
    }

    const latency = Date.now() - startTime;
    
    // Cleanup
    await fetch(`${url}/del/${testKey}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});

    return {
      service: 'Redis',
      status: 'ok',
      latency,
      message: 'Connected successfully',
      timestamp: Date.now(),
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      service: 'Redis',
      status: 'error',
      latency,
      message: error instanceof Error ? error.message : 'Connection failed',
      timestamp: Date.now(),
    };
  }
}

export async function checkLocalNews(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    // Check Redis connection
    const redisCheck = await checkRedis();
    if (redisCheck.status !== 'ok') {
      return {
        service: 'Local News',
        status: 'error',
        latency: Date.now() - startTime,
        message: 'Redis connection failed',
        timestamp: Date.now(),
      };
    }

    // Check seed file existence
    const { checkSeedFileExists } = await import('./news/local');
    const seedExists = await checkSeedFileExists();
    
    const latency = Date.now() - startTime;

    if (!seedExists) {
      return {
        service: 'Local News',
        status: 'warning',
        latency,
        message: 'Missing seed file at /data/news/seed.json',
        timestamp: Date.now(),
        details: { seed_file_exists: false },
      };
    }

    // Try to get news to verify it works
    const { getLocalNews } = await import('./news/local');
    const { results } = await getLocalNews();

    return {
      service: 'Local News',
      status: 'ok',
      latency,
      message: `OK (Local) - ${results.length} articles available`,
      timestamp: Date.now(),
      details: { 
        count: results.length,
        seed_file_exists: true,
        source: 'local',
      },
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Check failed';
    
    return {
      service: 'Local News',
      status: 'error',
      latency,
      message: errorMessage,
      timestamp: Date.now(),
    };
  }
}

export async function checkHuggingFace(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const { isHFConfigured } = await import('./hf/client');
    
    if (!isHFConfigured()) {
      console.log("Sentiment disabled");
      return {
        service: 'Hugging Face API',
        status: 'warning',
        latency: 0,
        message: 'Disabled - API key missing',
        timestamp: Date.now(),
        details: { 
          status: 'DISABLED',
          disabled: true,
          logs: ['Sentiment API disabled'],
        },
      };
    }
    
    const { hfRequest } = await import('./hf/client');
    const { getCache, setCache } = await import('./redis');

    // Check if there's a cached AUTH_ERROR status
    try {
      const hfStatus = await getCache('hf:status');
      if (hfStatus && typeof hfStatus === 'object' && hfStatus.status === 'AUTH_ERROR') {
        return {
          service: 'Hugging Face API',
          status: 'error',
          latency: 0,
          message: 'Authentication error - invalid or expired API key',
          timestamp: Date.now(),
          details: { status: 'AUTH_ERROR', cached: true },
        };
      }
    } catch {
      // Ignore cache errors
    }

    // Use unified single model (same as sentiment.ts)
    const DEFAULT_MODEL = process.env.HF_MODEL || "kk08/CryptoBERT";
    
    try {
      const data = await hfRequest(DEFAULT_MODEL, { inputs: 'Bitcoin is rising!' }, { timeout: 10000 });
      
      // Parse response - normalize output
      const [label, score] = data?.[0]?.[0]
        ? [data[0][0].label, data[0][0].score]
        : data?.[0]?.label && data?.[0]?.score
        ? [data[0].label, data[0].score]
        : ["neutral", 0.5];

      const latency = Date.now() - startTime;

      // Clear AUTH_ERROR status on success
      try {
        await setCache('hf:status', { status: 'OK', model: DEFAULT_MODEL, timestamp: Date.now() }, 3600);
      } catch {
        // Ignore cache errors
      }

      return {
        service: 'Hugging Face API',
        status: 'ok',
        latency,
        message: `Working with model: ${DEFAULT_MODEL.split('/').pop()}`,
        timestamp: Date.now(),
        details: { 
          status: 'OK',
          model: DEFAULT_MODEL.split('/').pop(),
          label: label || 'N/A',
          score: score || 0,
          latency_ms: latency,
        },
      };
    } catch (error) {
      const lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Check if it's an auth error
      if (lastError.message.includes('401') || lastError.message.includes('403') || 
          lastError.message.includes('Unauthorized') || lastError.message.includes('Forbidden')) {
        // Store AUTH_ERROR status
        try {
          await setCache('hf:status', { status: 'AUTH_ERROR', timestamp: Date.now() }, 3600);
          const { logError } = await import('./errors/logs');
          await logError('Hugging Face', lastError.message, lastError.message.includes('401') ? 401 : 403);
        } catch {
          // Ignore logging errors
        }
        
        const latency = Date.now() - startTime;
        return {
          service: 'Hugging Face API',
          status: 'error',
          latency,
          message: `Authentication failed (${lastError.message.includes('401') ? '401' : '403'}) - check API key`,
          timestamp: Date.now(),
          details: { 
            status: 'AUTH_ERROR',
            model: DEFAULT_MODEL.split('/').pop(),
            error: lastError.message,
          },
        };
      }
      
      // Handle model unavailable (410)
      if (lastError.message.includes('410') || lastError.message.includes('Model removed')) {
        const errorMsg = `Model unavailable: ${DEFAULT_MODEL} (410)`;
        const latency = Date.now() - startTime;
        
        const { logError } = await import('./errors/logs');
        await logError('Hugging Face', errorMsg, 410);
        
        return {
          service: 'Hugging Face API',
          status: 'error',
          latency,
          message: errorMsg,
          timestamp: Date.now(),
          details: { 
            status: 'FAIL',
            model: DEFAULT_MODEL.split('/').pop(),
            error: errorMsg,
          },
        };
      }

      // Other errors
      const latency = Date.now() - startTime;
      const errorMessage = lastError.message;
      
      const { logError } = await import('./errors/logs');
      await logError('Hugging Face', errorMessage);
      
      return {
        service: 'Hugging Face API',
        status: 'error',
        latency,
        message: errorMessage,
        timestamp: Date.now(),
        details: { status: 'FAIL', model: DEFAULT_MODEL.split('/').pop() },
      };
    }
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Connection failed';
    
    // Log error
    const { logError } = await import('./errors/logs');
    await logError('Hugging Face', errorMessage);
    
    return {
      service: 'Hugging Face API',
      status: 'error',
      latency,
      message: errorMessage,
      timestamp: Date.now(),
      details: { status: 'FAIL' },
    };
  }
}

export async function checkMarketAPI(baseUrl: string = ''): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const url = baseUrl ? `${baseUrl}/api/markets` : '/api/markets';
    const response = await fetchWithTimeout(url, {}, 8000);

    const latency = Date.now() - startTime;

    if (!response.ok) {
      // Log error
      const { logError } = await import('./errors/logs');
      await logError('Market API', `HTTP ${response.status}: ${response.statusText}`, response.status);
      
      // Try to get cached data as fallback
      if (response.status === 401 || response.status === 403) {
        try {
          const { getCache } = await import('./redis');
          const cached = await getCache('market_live_prices');
          if (cached) {
            return {
              service: 'Market API',
              status: 'warning',
              latency,
              message: `Auth failed but using cached data`,
              timestamp: Date.now(),
              details: { usingCache: true },
            };
          }
        } catch {
          // Ignore cache errors
        }
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    const hasLivePrices = data.live && Array.isArray(data.live) && data.live.length > 0;
    const hasHistory = data.history && typeof data.history === 'object';

    if (!hasLivePrices) {
      return {
        service: 'Market API',
        status: 'warning',
        latency,
        message: 'No live prices available',
        timestamp: Date.now(),
      };
    }

    return {
      service: 'Market API',
      status: 'ok',
      latency,
      message: `Live prices for ${data.live.length} coins`,
      timestamp: Date.now(),
      details: { coins: data.live.length, hasHistory },
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Connection failed';
    
    // Log error
    const { logError } = await import('./errors/logs');
    await logError('Market API', errorMessage);
    
    return {
      service: 'Market API',
      status: 'error',
      latency,
      message: errorMessage,
      timestamp: Date.now(),
    };
  }
}


export async function checkRedisLatency(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!url || !token) {
      return {
        service: 'Redis Latency',
        status: 'error',
        latency: 0,
        message: 'Missing credentials',
        timestamp: Date.now(),
      };
    }

    // Round-trip test
    const testKey = `latency-test-${Date.now()}`;
    
    await fetchWithTimeout(
      `${url}/set/${testKey}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify('test'),
      }
    );

    await fetchWithTimeout(
      `${url}/get/${testKey}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const latency = Date.now() - startTime;

    // Cleanup
    await fetch(`${url}/del/${testKey}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});

    return {
      service: 'Redis Latency',
      status: latency < 500 ? 'ok' : latency < 1000 ? 'warning' : 'error',
      latency,
      message: `${latency}ms round-trip`,
      timestamp: Date.now(),
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      service: 'Redis Latency',
      status: 'error',
      latency,
      message: error instanceof Error ? error.message : 'Test failed',
      timestamp: Date.now(),
    };
  }
}

export function checkVercelEnv(): HealthCheckResult {
  const requiredVars = [
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'HUGGINGFACE_API_KEY',
  ];

  const missing: string[] = [];
  const present: string[] = [];

  requiredVars.forEach(varName => {
    if (process.env[varName]) {
      present.push(varName);
    } else {
      missing.push(varName);
    }
  });

  const status = missing.length === 0 ? 'ok' : missing.length <= 2 ? 'warning' : 'error';
  const message = missing.length === 0 
    ? 'All environment variables set' 
    : `Missing: ${missing.join(', ')}`;

  return {
    service: 'Vercel Environment',
    status,
    latency: 0,
    message,
    timestamp: Date.now(),
    details: { present, missing },
  };
}

export async function checkGitHub(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const owner = 'GiovanniM-maker';
    const repo = 'trading_playground';
    
    const response = await fetchWithTimeout(
      `https://api.github.com/repos/${owner}/${repo}/commits/main`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    const latency = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    const commit = Array.isArray(data) ? data[0] : data;
    
    return {
      service: 'GitHub Sync',
      status: 'ok',
      latency,
      message: commit?.commit?.message || 'Latest commit fetched',
      timestamp: Date.now(),
      details: {
        author: commit?.commit?.author?.name,
        date: commit?.commit?.author?.date,
        sha: commit?.sha?.substring(0, 7),
      },
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      service: 'GitHub Sync',
      status: 'error',
      latency,
      message: error instanceof Error ? error.message : 'Connection failed',
      timestamp: Date.now(),
    };
  }
}

export async function runAllChecks(baseUrl: string = ''): Promise<HealthCheckResult[]> {
  const checks = [
    checkRedis(),
    checkLocalNews(),
    checkHuggingFace(),
    checkMarketAPI(baseUrl),
    checkRedisLatency(),
    Promise.resolve(checkVercelEnv()),
    checkGitHub(),
  ];

  return Promise.all(checks);
}


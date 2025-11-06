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

export async function checkCryptoPanic(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const apiKey = process.env.CRYPTOPANIC_API_KEY;
    
    if (!apiKey) {
      return {
        service: 'CryptoPanic API',
        status: 'warning',
        latency: 0,
        message: 'Not configured - API key missing',
        timestamp: Date.now(),
      };
    }

    // Use new v1 endpoint
    const url = `https://cryptopanic.com/api/v1/posts/?auth_token=${apiKey}&public=true&size=1`;
    
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TradingBot/1.0)',
          'Accept': 'application/json',
        },
      },
      8000
    );

    const latency = Date.now() - startTime;

    if (!response.ok) {
      // Log error
      const { logError } = await import('./errors/logs');
      await logError('CryptoPanic', `HTTP ${response.status}: ${response.statusText}`, response.status);
      
      if (response.status === 404) {
        return {
          service: 'CryptoPanic API',
          status: 'error',
          latency,
          message: `Endpoint not found (404) - API may have changed`,
          timestamp: Date.now(),
        };
      }
      if (response.status === 401 || response.status === 403) {
        return {
          service: 'CryptoPanic API',
          status: 'error',
          latency,
          message: `Authentication failed (${response.status}) - check API key`,
          timestamp: Date.now(),
        };
      }
      if (response.status === 500 || response.status === 502) {
        return {
          service: 'CryptoPanic API',
          status: 'warning',
          latency,
          message: `Server issue (${response.status}) - CryptoPanic may be experiencing downtime`,
          timestamp: Date.now(),
        };
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      service: 'CryptoPanic API',
      status: 'ok',
      latency,
      message: `Connected (${data.results?.length || 0} items available)`,
      timestamp: Date.now(),
      details: { count: data.results?.length || 0 },
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Connection failed';
    
    // Log error
    const { logError } = await import('./errors/logs');
    await logError('CryptoPanic', errorMessage);
    
    return {
      service: 'CryptoPanic API',
      status: 'error',
      latency,
      message: errorMessage,
      timestamp: Date.now(),
    };
  }
}

export async function checkNewsData(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const apiKey = process.env.NEWSDATA_API_KEY;
    
    if (!apiKey) {
      return {
        service: 'NewsData.io API',
        status: 'warning',
        latency: 0,
        message: 'Not configured - API key missing',
        timestamp: Date.now(),
      };
    }

    const url = `https://newsdata.io/api/1/news?apikey=${apiKey}&q=crypto&language=en&size=1`;
    
    const response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
      },
      8000
    );

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      
      // Log error
      const { logError } = await import('./errors/logs');
      await logError('NewsData.io', `HTTP ${response.status}: ${errorText}`, response.status);
      
      if (response.status === 401 || response.status === 403) {
        return {
          service: 'NewsData.io API',
          status: 'error',
          latency,
          message: `Authentication failed (${response.status}) - check API key`,
          timestamp: Date.now(),
        };
      }
      if (response.status === 429) {
        return {
          service: 'NewsData.io API',
          status: 'warning',
          latency,
          message: `Rate limit exceeded (${response.status})`,
          timestamp: Date.now(),
        };
      }
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    return {
      service: 'NewsData.io API',
      status: 'ok',
      latency,
      message: `Connected (${data.results?.length || 0} articles available)`,
      timestamp: Date.now(),
      details: { 
        count: data.results?.length || 0,
        total_results: data.totalResults || 0,
      },
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Connection failed';
    
    // Log error
    const { logError } = await import('./errors/logs');
    await logError('NewsData.io', errorMessage);
    
    return {
      service: 'NewsData.io API',
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
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    
    if (!apiKey) {
      return {
        service: 'Hugging Face API',
        status: 'warning',
        latency: 0,
        message: 'Not configured - API key missing',
        timestamp: Date.now(),
      };
    }

    // Use only CryptoBERT model
    const model = 'kk08/CryptoBERT';
    const modelUrl = `https://api-inference.huggingface.co/models/${model}`;
    
    const response = await fetchWithTimeout(
      modelUrl,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: 'Bitcoin is rising!' }),
      },
      10000
    );

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      
      // Log error
      const { logError } = await import('./errors/logs');
      await logError('Hugging Face', `HTTP ${response.status}: ${errorText}`, response.status);
      
      if (response.status === 401 || response.status === 403) {
        return {
          service: 'Hugging Face API',
          status: 'error',
          latency,
          message: `Authentication failed (${response.status}) - check API key`,
          timestamp: Date.now(),
          details: { model, error: errorText },
        };
      }
      
      if (response.status === 410 || response.status === 404) {
        return {
          service: 'Hugging Face API',
          status: 'error',
          latency,
          message: `Model ${model} unavailable (${response.status})`,
          timestamp: Date.now(),
          details: { model, error: errorText },
        };
      }

      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    // Parse CryptoBERT response format
    let result: any;
    if (Array.isArray(data) && data.length > 0) {
      result = Array.isArray(data[0]) ? data[0] : data;
    } else if (data && typeof data === 'object') {
      result = data;
    } else {
      throw new Error('Invalid response format');
    }

    // Extract label and score
    const label = Array.isArray(result) 
      ? result.find((r: any) => r.score === Math.max(...result.map((r: any) => r.score || 0)))?.label
      : result.label;
    const score = Array.isArray(result)
      ? Math.max(...result.map((r: any) => r.score || 0))
      : result.score;

    return {
      service: 'Hugging Face API',
      status: 'ok',
      latency,
      message: `Working with model: ${model.split('/').pop()}`,
      timestamp: Date.now(),
      details: { 
        model: model.split('/').pop(),
        label: label || 'N/A',
        score: score || 0,
        latency_ms: latency,
      },
    };
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

export async function checkNewsAPI(baseUrl: string = ''): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const url = baseUrl ? `${baseUrl}/api/news` : '/api/news';
    const response = await fetchWithTimeout(url, {}, 8000);

    const latency = Date.now() - startTime;

    if (!response.ok) {
      // Log error
      const { logError } = await import('./errors/logs');
      await logError('News API', `HTTP ${response.status}: ${response.statusText}`, response.status);
      
      // Check if NewsData.io is configured as fallback
      if ((response.status === 401 || response.status === 403) && process.env.NEWSDATA_API_KEY) {
        return {
          service: 'News API',
          status: 'warning',
          latency,
          message: 'Primary sources failed, but NewsData.io fallback available',
          timestamp: Date.now(),
          details: { usingFallback: true },
        };
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    const hasResults = data.results && Array.isArray(data.results) && data.results.length > 0;

    if (!hasResults) {
      return {
        service: 'News API',
        status: 'warning',
        latency,
        message: 'No news items returned',
        timestamp: Date.now(),
      };
    }

    return {
      service: 'News API',
      status: 'ok',
      latency,
      message: `${data.results.length} news items`,
      timestamp: Date.now(),
      details: { count: data.results.length },
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Connection failed';
    
    // Log error
    const { logError } = await import('./errors/logs');
    await logError('News API', errorMessage);
    
    return {
      service: 'News API',
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
    'NEWSDATA_API_KEY',
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
    checkNewsData(),
    checkHuggingFace(),
    checkMarketAPI(baseUrl),
    checkNewsAPI(baseUrl),
    checkRedisLatency(),
    Promise.resolve(checkVercelEnv()),
    checkGitHub(),
  ];

  return Promise.all(checks);
}


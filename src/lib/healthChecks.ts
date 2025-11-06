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
    const plan = process.env.CRYPTOPANIC_PLAN || 'developer';
    
    if (!apiKey) {
      return {
        service: 'CryptoPanic API',
        status: 'error',
        latency: 0,
        message: 'Missing API key',
        timestamp: Date.now(),
      };
    }

    const response = await fetchWithTimeout(
      `https://cryptopanic.com/api/${plan}/v2/posts/?auth_token=${apiKey}&currencies=BTC&public=true&size=1`
    );

    const latency = Date.now() - startTime;

    if (!response.ok) {
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
    return {
      service: 'CryptoPanic API',
      status: 'error',
      latency,
      message: error instanceof Error ? error.message : 'Connection failed',
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
        status: 'error',
        latency: 0,
        message: 'Missing API key',
        timestamp: Date.now(),
      };
    }

    const response = await fetchWithTimeout(
      'https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: 'Bitcoin is rising!' }),
      }
    );

    const latency = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (Array.isArray(data) && data.length > 0) {
      return {
        service: 'Hugging Face API',
        status: 'ok',
        latency,
        message: 'Sentiment analysis working',
        timestamp: Date.now(),
        details: { label: data[0]?.label, score: data[0]?.score },
      };
    }

    throw new Error('Invalid response format');
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      service: 'Hugging Face API',
      status: 'error',
      latency,
      message: error instanceof Error ? error.message : 'Connection failed',
      timestamp: Date.now(),
    };
  }
}

export async function checkMarketAPI(baseUrl: string = ''): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/markets`);

    const latency = Date.now() - startTime;

    if (!response.ok) {
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
    return {
      service: 'Market API',
      status: 'error',
      latency,
      message: error instanceof Error ? error.message : 'Connection failed',
      timestamp: Date.now(),
    };
  }
}

export async function checkNewsAPI(baseUrl: string = ''): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/news`);

    const latency = Date.now() - startTime;

    if (!response.ok) {
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
    return {
      service: 'News API',
      status: 'error',
      latency,
      message: error instanceof Error ? error.message : 'Connection failed',
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
    'CRYPTOPANIC_API_KEY',
    'CRYPTOPANIC_PLAN',
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
    checkCryptoPanic(),
    checkHuggingFace(),
    checkMarketAPI(baseUrl),
    checkNewsAPI(baseUrl),
    checkRedisLatency(),
    Promise.resolve(checkVercelEnv()),
    checkGitHub(),
  ];

  return Promise.all(checks);
}


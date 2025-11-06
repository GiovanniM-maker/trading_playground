const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export async function getCache(key: string): Promise<any> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    console.warn('Redis credentials not configured');
    return null;
  }

  try {
    const res = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${key}`, {
      headers: { 
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      },
      cache: 'no-store',
    });

    const json = await res.json();
    return json.result ? JSON.parse(json.result) : null;
  } catch (error) {
    console.error(`Error getting cache for ${key}:`, error);
    return null;
  }
}

export async function setCache(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    console.warn('Redis credentials not configured');
    return false;
  }

  try {
    const serialized = JSON.stringify(value);
    const url = ttlSeconds 
      ? `${UPSTASH_REDIS_REST_URL}/setex/${key}/${ttlSeconds}`
      : `${UPSTASH_REDIS_REST_URL}/set/${key}`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: serialized,
      cache: 'no-store',
    });

    const json = await res.json();
    return json.result === 'OK';
  } catch (error) {
    console.error(`Error setting cache for ${key}:`, error);
    return false;
  }
}

export async function deleteCache(key: string): Promise<boolean> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return false;
  }

  try {
    const res = await fetch(`${UPSTASH_REDIS_REST_URL}/del/${key}`, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      },
      cache: 'no-store',
    });

    const json = await res.json();
    return json.result === 1;
  } catch (error) {
    console.error(`Error deleting cache for ${key}:`, error);
    return false;
  }
}

/**
 * Get value from cache, or fetch and cache it if not found
 * @param key Cache key
 * @param fetchFn Function to fetch the value if not in cache
 * @param ttlSeconds Time to live in seconds (default: 3600)
 * @returns The cached or freshly fetched value
 */
export async function getOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = 3600
): Promise<T> {
  // Try to get from cache first
  const cached = await getCache(key);
  if (cached !== null) {
    return cached as T;
  }

  // Fetch fresh data
  const data = await fetchFn();

  // Cache it for future requests
  await setCache(key, data, ttlSeconds);

  return data;
}

/**
 * Invalidate cache by key
 * @param key Cache key to invalidate
 */
export async function invalidateCache(key: string): Promise<void> {
  await deleteCache(key);
}


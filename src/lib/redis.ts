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


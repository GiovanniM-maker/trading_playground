/**
 * Fetch with timeout support
 * Returns null on failure instead of throwing
 */
export async function fetchWithTimeout(
  url: string,
  timeout = 10000,
  options: RequestInit = {}
): Promise<Response | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(id);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return res;
  } catch (err) {
    clearTimeout(id);
    if (err instanceof Error && err.name === 'AbortError') {
      console.error(`Fetch timeout: ${url} (${timeout}ms)`);
    } else {
      console.error(`Fetch failed: ${url}`, err);
    }
    return null;
  }
}


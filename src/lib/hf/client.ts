/**
 * Centralized Hugging Face Inference API client
 * Ensures consistent authentication and error handling
 */

export interface HFRequestOptions {
  timeout?: number;
}

export async function hfRequest(model: string, payload: any, options: HFRequestOptions = {}): Promise<any> {
  const key = process.env.HUGGINGFACE_API_KEY;
  
  if (!key) {
    throw new Error("Missing HUGGINGFACE_API_KEY");
  }

  const { timeout = 10000 } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.status === 401) {
      throw new Error("Unauthorized (401) - Invalid or expired API key");
    }
    
    if (res.status === 403) {
      throw new Error("Forbidden (403) - API key lacks required permissions");
    }
    
    if (res.status === 410) {
      throw new Error(`Model removed (410) - Model ${model} is no longer available`);
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      throw new Error(`HF error ${res.status}: ${errorText}`);
    }

    return await res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    
    throw error;
  }
}

/**
 * Check if Hugging Face API key is configured
 */
export function isHFConfigured(): boolean {
  return !!process.env.HUGGINGFACE_API_KEY;
}

/**
 * Assert that Hugging Face API key is configured
 * Throws if missing, logs warning if configured
 */
export function assertHFConfig(): void {
  if (!isHFConfigured()) {
    console.warn("Hugging Face API key not configured - sentiment analysis will be disabled");
    throw new Error("Missing HUGGINGFACE_API_KEY environment variable");
  }
}


import { logger } from '../logger';

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
      const error = "Unauthorized (401) - Invalid or expired API key";
      const { sendAlert } = await import('../alert');
      await sendAlert('Hugging Face Client', error);
      throw new Error(error);
    }
    
    if (res.status === 403) {
      const error = "Forbidden (403) - API key lacks required permissions";
      const { sendAlert } = await import('../alert');
      await sendAlert('Hugging Face Client', error);
      throw new Error(error);
    }
    
    if (res.status === 410) {
      const error = `Model removed (410) - Model ${model} is no longer available`;
      const { sendAlert } = await import('../alert');
      await sendAlert('Hugging Face Client', error);
      throw new Error(error);
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      const error = `HF error ${res.status}: ${errorText}`;
      const { sendAlert } = await import('../alert');
      await sendAlert('Hugging Face Client', error);
      throw new Error(error);
    }

    return await res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = `Request timeout after ${timeout}ms`;
      const { sendAlert } = await import('../alert');
      await sendAlert('Hugging Face Client', timeoutError);
      throw new Error(timeoutError);
    }
    
    // Only alert on non-timeout errors that aren't already handled
    if (error instanceof Error && !error.message.includes('401') && !error.message.includes('403') && !error.message.includes('410')) {
      const { sendAlert } = await import('../alert');
      await sendAlert('Hugging Face Client', error.message);
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
    logger.warn({ service: 'hf-client' }, "Hugging Face API key not configured - sentiment analysis will be disabled");
    throw new Error("Missing HUGGINGFACE_API_KEY environment variable");
  }
}


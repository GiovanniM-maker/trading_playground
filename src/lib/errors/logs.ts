import { getCache, setCache } from '../redis';
import { randomUUID } from 'crypto';

export interface ErrorLogEntry {
  id: string;
  service: string;
  error: string;
  status?: number;
  timestamp: number;
  retryCount?: number;
  level?: 'ok' | 'warning' | 'error' | 'info';
  latency?: number;
}

const MAX_ERRORS = 200;
const ERROR_KEY = 'errors:logs';
const ERROR_TTL = 86400 * 7; // 7 days

export async function logError(
  service: string,
  error: string,
  status?: number,
  retryCount?: number,
  latency?: number
): Promise<ErrorLogEntry> {
  // Normalize log level based on status code
  const level =
    status === 200 ? "ok" :
    status && status >= 400 && status < 500 ? "error" :
    status && status >= 500 ? "warning" :
    "info";

  const entry: ErrorLogEntry = {
    id: randomUUID(),
    service,
    error,
    status,
    timestamp: Date.now(),
    retryCount,
    // Add normalized fields for compatibility
    level: level as any,
    latency,
  };

  try {
    const existing = await getCache(ERROR_KEY);
    const errors: ErrorLogEntry[] = existing && Array.isArray(existing) ? existing : [];

    errors.unshift(entry);
    if (errors.length > MAX_ERRORS) {
      errors.splice(MAX_ERRORS);
    }

    await setCache(ERROR_KEY, errors, ERROR_TTL);
  } catch (err) {
    console.error('Error logging to Redis:', err);
  }

  return entry;
}

export async function getErrorLogs(limit: number = 100): Promise<ErrorLogEntry[]> {
  try {
    const errors = await getCache(ERROR_KEY);
    if (errors && Array.isArray(errors)) {
      return errors.slice(0, limit) as ErrorLogEntry[];
    }
  } catch (error) {
    console.error('Error getting error logs:', error);
  }
  return [];
}

export async function getErrorCountByService(): Promise<Record<string, number>> {
  try {
    const errors = await getErrorLogs(200);
    const counts: Record<string, number> = {};
    
    for (const error of errors) {
      counts[error.service] = (counts[error.service] || 0) + 1;
    }
    
    return counts;
  } catch (error) {
    console.error('Error getting error counts:', error);
    return {};
  }
}


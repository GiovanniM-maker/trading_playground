import { getCache, setCache } from '../redis';

export interface LogEntry {
  timestamp: number;
  status?: 'OK' | 'ERROR' | 'WARNING';
  level?: 'ok' | 'warning' | 'error' | 'info';
  code?: number;
  latency?: number;
  message?: string;
  time?: number | string;
  json?: any;
  error?: string;
}

const MAX_LOGS = 30;
const LOG_TTL = 86400; // 24 hours

// In-memory storage as fallback
const memoryLogs: Map<string, LogEntry[]> = new Map();

export async function logEvent(service: string, entry: LogEntry): Promise<void> {
  // Normalize log entry with level field
  const normalizedEntry: LogEntry = {
    ...entry,
    timestamp: entry.timestamp || Date.now(),
    time: entry.time || new Date(entry.timestamp || Date.now()).toISOString(),
    // Determine level from status or code
    level: entry.level || (() => {
      if (entry.status) {
        const status = entry.status.toLowerCase();
        if (status === 'ok') return 'ok';
        if (status === 'error') return 'error';
        if (status === 'warning') return 'warning';
      }
      if (entry.code) {
        if (entry.code === 200) return 'ok';
        if (entry.code >= 400 && entry.code < 500) return 'error';
        if (entry.code >= 500) return 'warning';
      }
      return 'info';
    })(),
  };

  // Store in memory
  if (!memoryLogs.has(service)) {
    memoryLogs.set(service, []);
  }
  const memoryLog = memoryLogs.get(service)!;
  memoryLog.unshift(normalizedEntry);
  if (memoryLog.length > MAX_LOGS) {
    memoryLog.splice(MAX_LOGS);
  }

  // Store in Redis
  try {
    const key = `logs:${service}`;
    const existing = await getCache(key);
    const logs: LogEntry[] = existing && Array.isArray(existing) ? existing : [];
    
    logs.unshift(normalizedEntry);
    if (logs.length > MAX_LOGS) {
      logs.splice(MAX_LOGS);
    }

    await setCache(key, logs, LOG_TTL);
  } catch (error) {
    console.error(`Error logging event for ${service}:`, error);
    // Continue with memory-only storage
  }
}

export async function getLogs(service: string): Promise<LogEntry[]> {
  // Try Redis first
  try {
    const key = `logs:${service}`;
    const logs = await getCache(key);
    if (logs && Array.isArray(logs)) {
      return logs as LogEntry[];
    }
  } catch (error) {
    console.error(`Error getting logs for ${service}:`, error);
  }

  // Fallback to memory
  return memoryLogs.get(service) || [];
}

export async function clearLogs(service?: string): Promise<void> {
  if (service) {
    memoryLogs.delete(service);
    try {
      const key = `logs:${service}`;
      await setCache(key, [], LOG_TTL);
    } catch (error) {
      console.error(`Error clearing logs for ${service}:`, error);
    }
  } else {
    // Clear all
    memoryLogs.clear();
    // Note: Redis keys would need to be cleared individually
  }
}


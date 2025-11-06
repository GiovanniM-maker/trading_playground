import { getCache, setCache } from '../redis';

export interface LogEntry {
  timestamp: number;
  status: 'OK' | 'ERROR' | 'WARNING';
  code?: number;
  latency?: number;
  message?: string;
  json?: any;
}

const MAX_LOGS = 30;
const LOG_TTL = 86400; // 24 hours

// In-memory storage as fallback
const memoryLogs: Map<string, LogEntry[]> = new Map();

export async function logEvent(service: string, entry: LogEntry): Promise<void> {
  // Store in memory
  if (!memoryLogs.has(service)) {
    memoryLogs.set(service, []);
  }
  const memoryLog = memoryLogs.get(service)!;
  memoryLog.unshift(entry);
  if (memoryLog.length > MAX_LOGS) {
    memoryLog.splice(MAX_LOGS);
  }

  // Store in Redis
  try {
    const key = `logs:${service}`;
    const existing = await getCache(key);
    const logs: LogEntry[] = existing && Array.isArray(existing) ? existing : [];
    
    logs.unshift(entry);
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


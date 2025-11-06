import { getCache, setCache } from '../redis';
import { randomUUID } from 'crypto';

export interface SentimentLogEntry {
  id: string;
  text: string;
  label: 'positive' | 'neutral' | 'negative';
  score: number;
  timestamp: number;
}

const MAX_LOGS = 100;
const LOG_KEY = 'sentiment:logs';
const LOG_TTL = 86400 * 7; // 7 days

export async function logSentiment(
  text: string,
  label: 'positive' | 'neutral' | 'negative',
  score: number
): Promise<SentimentLogEntry> {
  const entry: SentimentLogEntry = {
    id: randomUUID(),
    text: text.length > 500 ? text.substring(0, 500) + '...' : text, // Truncate long texts
    label,
    score,
    timestamp: Date.now(),
  };

  try {
    // Get existing logs
    const existing = await getCache(LOG_KEY);
    const logs: SentimentLogEntry[] = existing && Array.isArray(existing) ? existing : [];

    // Add new entry at the beginning
    logs.unshift(entry);

    // Keep only last MAX_LOGS entries
    if (logs.length > MAX_LOGS) {
      logs.splice(MAX_LOGS);
    }

    // Save back to Redis
    await setCache(LOG_KEY, logs, LOG_TTL);
  } catch (error) {
    console.error('Error logging sentiment:', error);
    // Continue even if logging fails
  }

  return entry;
}

export async function getSentimentLogs(limit: number = 100): Promise<SentimentLogEntry[]> {
  try {
    const logs = await getCache(LOG_KEY);
    if (logs && Array.isArray(logs)) {
      return logs.slice(0, limit) as SentimentLogEntry[];
    }
  } catch (error) {
    console.error('Error getting sentiment logs:', error);
  }
  return [];
}

export async function clearSentimentLogs(): Promise<void> {
  try {
    await setCache(LOG_KEY, [], LOG_TTL);
  } catch (error) {
    console.error('Error clearing sentiment logs:', error);
  }
}


import pino from 'pino';
import { getCache, setCache } from './redis';

// Create logger instance
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

// Store logs in Redis (last 200 entries)
async function storeLogInRedis(level: string, message: string, data?: any) {
  try {
    const logKey = 'errors:logs';
    const existingLogs = await getCache(logKey);
    const logs = Array.isArray(existingLogs) ? existingLogs : [];
    
    const logEntry = {
      level,
      message,
      data: data || {},
      timestamp: Date.now(),
      id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };
    
    logs.push(logEntry);
    
    // Keep only last 200 entries
    if (logs.length > 200) {
      logs.shift();
    }
    
    await setCache(logKey, logs, 0);
  } catch (error) {
    // Don't throw - logging failures shouldn't break the app
    console.error('Failed to store log in Redis:', error);
  }
}

// Enhanced logger with Redis storage
export const appLogger = {
  info: (message: string, data?: any) => {
    logger.info(data, message);
    storeLogInRedis('info', message, data).catch(() => {});
  },
  
  error: (message: string, error?: Error | any, data?: any) => {
    const errorData = {
      ...data,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    };
    logger.error(errorData, message);
    storeLogInRedis('error', message, errorData).catch(() => {});
  },
  
  warn: (message: string, data?: any) => {
    logger.warn(data, message);
    storeLogInRedis('warn', message, data).catch(() => {});
  },
  
  debug: (message: string, data?: any) => {
    logger.debug(data, message);
    // Don't store debug logs in Redis to save space
  },
  
  // Structured logging for API requests
  api: (method: string, path: string, status: number, duration: number, data?: any) => {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    const message = `${method} ${path} ${status} (${duration}ms)`;
    appLogger[level](message, { ...data, method, path, status, duration });
  },
};

// Export default logger for compatibility
export default logger;

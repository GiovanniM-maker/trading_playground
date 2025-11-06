import { appLogger } from './logger';

interface AlertOptions {
  level: 'error' | 'warning' | 'info';
  message: string;
  context?: Record<string, any>;
  service?: string;
}

// Send alert to webhook (Slack, Discord, etc.)
async function sendWebhookAlert(options: AlertOptions): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    return; // No webhook configured
  }

  try {
    const payload = {
      text: `🚨 ${options.level.toUpperCase()}: ${options.message}`,
      service: options.service || 'Trading System',
      level: options.level,
      message: options.message,
      context: options.context,
      timestamp: new Date().toISOString(),
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    appLogger.error('Failed to send webhook alert', error);
  }
}

// Monitor API responses and alert on 5xx errors
export function monitorApiResponse(
  method: string,
  path: string,
  status: number,
  duration: number,
  error?: Error
): void {
  // Log the request
  appLogger.api(method, path, status, duration);

  // Alert on 5xx errors
  if (status >= 500) {
    sendWebhookAlert({
      level: 'error',
      message: `API Error: ${method} ${path} returned ${status}`,
      context: {
        method,
        path,
        status,
        duration,
        error: error?.message,
      },
      service: 'API',
    }).catch(() => {});
  }

  // Warn on 4xx errors (but don't alert)
  if (status >= 400 && status < 500) {
    appLogger.warn(`API Warning: ${method} ${path} returned ${status}`, {
      method,
      path,
      status,
      duration,
    });
  }
}

// Monitor critical errors
export function monitorError(
  error: Error,
  context?: Record<string, any>,
  service?: string
): void {
  appLogger.error('Critical error detected', error, context);

  sendWebhookAlert({
    level: 'error',
    message: error.message,
    context: {
      ...context,
      stack: error.stack,
      name: error.name,
    },
    service: service || 'System',
  }).catch(() => {});
}

// Monitor performance issues
export function monitorPerformance(
  operation: string,
  duration: number,
  threshold: number = 5000
): void {
  if (duration > threshold) {
    appLogger.warn(`Performance issue: ${operation} took ${duration}ms`, {
      operation,
      duration,
      threshold,
    });

    sendWebhookAlert({
      level: 'warning',
      message: `Performance issue: ${operation} took ${duration}ms`,
      context: {
        operation,
        duration,
        threshold,
      },
      service: 'Performance',
    }).catch(() => {});
  }
}

// Health check monitoring
export function monitorHealthCheck(
  service: string,
  status: 'ok' | 'warning' | 'error',
  latency: number
): void {
  if (status === 'error') {
    sendWebhookAlert({
      level: 'error',
      message: `Service ${service} is down`,
      context: {
        service,
        status,
        latency,
      },
      service: 'Health Check',
    }).catch(() => {});
  } else if (status === 'warning') {
    appLogger.warn(`Service ${service} has warnings`, {
      service,
      status,
      latency,
    });
  }
}


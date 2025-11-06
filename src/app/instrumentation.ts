import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize Sentry for Node.js runtime
    Sentry.init({
      dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 1.0,
      debug: false,
      beforeSend(event, hint) {
        // Don't send events in development
        if (process.env.NODE_ENV === 'development') {
          return null;
        }
        
        // Remove sensitive data from event
        if (event.request) {
          delete event.request.cookies;
          delete event.request.headers?.['authorization'];
        }
        
        return event;
      },
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Initialize Sentry for Edge runtime
    Sentry.init({
      dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 1.0,
      debug: false,
    });
  }
}


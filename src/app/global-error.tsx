'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body>
        <ErrorBoundary>
          <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
            <div className="text-center p-8">
              <h1 className="text-4xl font-bold mb-4">Something went wrong!</h1>
              <p className="text-gray-400 mb-6">
                {error.message || 'An unexpected error occurred'}
              </p>
              <button
                onClick={reset}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        </ErrorBoundary>
      </body>
    </html>
  );
}


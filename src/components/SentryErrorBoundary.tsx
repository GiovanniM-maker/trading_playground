'use client';

import * as Sentry from '@sentry/nextjs';
import { ReactNode } from 'react';

interface SentryErrorBoundaryProps {
  children: ReactNode;
}

export function SentryErrorBoundary({ children }: SentryErrorBoundaryProps) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return (
          <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
              <p className="text-gray-400 mb-4">{errorMessage}</p>
              <button
                onClick={resetError}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
              >
                Try again
              </button>
            </div>
          </div>
        );
      }}
      showDialog
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}


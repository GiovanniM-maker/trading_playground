'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    
    // Log to Sentry if available
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    }

    // Log to API
    fetch('/api/system/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: Date.now(),
      }),
    }).catch(err => {
      console.error('Failed to log error to API:', err);
    });

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#0c0c0d] text-[#f5f5e8] p-6">
          <div className="max-w-md w-full bg-[#181818] border border-[#ff4d4d]/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-[#ff4d4d]" size={24} />
              <h2 className="text-xl font-semibold text-[#ff4d4d]">Something went wrong</h2>
            </div>
            
            <p className="text-sm text-[#a9a9a9] mb-4">
              An unexpected error occurred. Please try refreshing the page.
            </p>

            {this.state.error && (
              <details className="mb-4">
                <summary className="text-xs text-[#a9a9a9] cursor-pointer mb-2">
                  Error details
                </summary>
                <pre className="text-xs bg-[#0c0c0d] border border-[#222] rounded p-3 overflow-auto max-h-40 text-[#f5f5e8]">
                  {this.state.error.message}
                  {this.state.error.stack && (
                    <>
                      {'\n\n'}
                      {this.state.error.stack}
                    </>
                  )}
                </pre>
              </details>
            )}

            <div className="flex gap-2">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#00b686]/20 text-[#00b686] border border-[#00b686]/30 hover:bg-[#00b686]/30 rounded transition-colors"
              >
                <RefreshCw size={16} />
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm font-medium bg-[#181818] text-[#f5f5e8] border border-[#222] hover:border-[#3a3a3a] rounded transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


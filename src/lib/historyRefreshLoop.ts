import { refreshHistory, COINS } from './history';

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
let lastRefresh: Date | null = null;
let lastResult: { success: number; failed: number } | null = null;

export async function startHistoryRefreshLoop(): Promise<void> {
  if (isRunning) {
    console.log('[HistoryRefresh] Loop is already running');
    return;
  }

  isRunning = true;
  console.log('[HistoryRefresh] Starting automatic history refresh loop (every 15s)...');

  // Run immediately on start
  await executeRefreshCycle();

  // Then run every 15 seconds
  intervalId = setInterval(async () => {
    await executeRefreshCycle();
  }, 15000);
}

export function stopHistoryRefreshLoop(): void {
  if (!isRunning) {
    console.log('[HistoryRefresh] Loop is not running');
    return;
  }

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  isRunning = false;
  console.log('[HistoryRefresh] Refresh loop stopped');
}

export function getHistoryRefreshStatus(): { 
  running: boolean; 
  lastRefresh: string | null;
  lastResult: { success: number; failed: number } | null;
} {
  return { 
    running: isRunning,
    lastRefresh: lastRefresh ? lastRefresh.toISOString() : null,
    lastResult,
  };
}

async function executeRefreshCycle(): Promise<void> {
  try {
    console.log('[HistoryRefresh] Starting refresh cycle...');
    const startTime = Date.now();
    
    // Refresh last 7 days for all symbols (in parallel)
    const symbols = COINS.map(c => c.symbol);
    const results = await Promise.allSettled(
      symbols.map(async (symbol) => {
        try {
          await refreshHistory(symbol, 7, false); // 7 days, no force
          return { symbol, ok: true };
        } catch (error) {
          console.error(`[HistoryRefresh] Failed to refresh ${symbol}:`, error);
          return { symbol, ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length;
    
    lastRefresh = new Date();
    lastResult = { success: successful, failed };
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[HistoryRefresh] ✅ Cycle completed in ${elapsed}s - Success: ${successful}/${symbols.length}, Failed: ${failed}`);
  } catch (error) {
    console.error('[HistoryRefresh] Refresh cycle error:', error);
    // Don't stop the loop on errors
  }
}

// Auto-start in production mode
if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
  // Small delay to ensure Redis is ready
  setTimeout(() => {
    startHistoryRefreshLoop().catch(console.error);
  }, 5000);
}


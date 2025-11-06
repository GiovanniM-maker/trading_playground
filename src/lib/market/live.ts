'use client';

import { useState, useEffect, useCallback } from 'react';
import { getLivePrices, LivePrice } from './fetch';

const POLL_INTERVAL = 15000; // 15 seconds
const DEBOUNCE_MS = 500;

let globalPrices: LivePrice[] = [];
let subscribers: Set<(prices: LivePrice[]) => void> = new Set();
let pollInterval: NodeJS.Timeout | null = null;
let lastUpdate = 0;
let isPolling = false;

function notifySubscribers() {
  subscribers.forEach(callback => {
    try {
      callback([...globalPrices]);
    } catch (error) {
      console.error('Error notifying subscriber:', error);
    }
  });
}

async function updatePrices() {
  const now = Date.now();
  
  // Debounce rapid calls
  if (now - lastUpdate < DEBOUNCE_MS) {
    return;
  }

  lastUpdate = now;

  try {
    const prices = await getLivePrices();
    globalPrices = prices;
    notifySubscribers();
  } catch (error) {
    console.error('Error updating live prices:', error);
  }
}

function startPolling() {
  if (isPolling) return;
  
  isPolling = true;
  updatePrices(); // Initial fetch
  
  pollInterval = setInterval(() => {
    updatePrices();
  }, POLL_INTERVAL);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  isPolling = false;
}

export function useLivePrices(): {
  prices: LivePrice[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
} {
  const [prices, setPrices] = useState<LivePrice[]>(globalPrices);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await updatePrices();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh prices'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Subscribe to updates
    const subscriber = (newPrices: LivePrice[]) => {
      setPrices([...newPrices]);
      setLoading(false);
      setError(null);
    };

    subscribers.add(subscriber);
    
    // Set initial state
    if (globalPrices.length > 0) {
      subscriber(globalPrices);
    } else {
      setLoading(true);
    }

    // Start polling if not already started
    startPolling();

    // Cleanup
    return () => {
      subscribers.delete(subscriber);
      
      // Stop polling if no subscribers left
      if (subscribers.size === 0) {
        stopPolling();
      }
    };
  }, []);

  return { prices, loading, error, refresh };
}


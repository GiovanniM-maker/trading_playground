'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Trash2, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HistoryRefreshControl } from '@/components/HistoryRefreshControl';

interface HistoryStatus {
  symbol: string;
  available: boolean;
  years: number[];
  points: number;
  from: string | null;
  to: string | null;
  confidence: number | null;
  sources_used: string[];
  footprint_bytes: number;
  missing_years: number[];
  last_updated: string | null;
  updated_days: number;
}

interface HistoryPanelProps {
  onClose?: () => void;
}

export function HistoryPanel({ onClose }: HistoryPanelProps) {
  const [statuses, setStatuses] = useState<HistoryStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [backfilling, setBackfilling] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [clearing, setClearing] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [refreshDays, setRefreshDays] = useState(30);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [refreshSymbol, setRefreshSymbol] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/history/status');
      if (!response.ok) throw new Error('Failed to fetch status');
      const data = await response.json();
      setStatuses(data.statuses || []);
    } catch (error) {
      console.error('Error fetching history status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackfill = async (force = false) => {
    if (!confirm(`Are you sure you want to ${force ? 'force rebuild' : 'backfill'} ALL historical data for all cryptocurrencies? This may take a few minutes.`)) {
      return;
    }

    setBackfilling(true);
    const startTime = Date.now();
    try {
      const response = await fetch('/api/admin/history/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }), // No days parameter = full history
      });

      if (!response.ok) throw new Error('Backfill failed');
      
      const result = await response.json();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      const successful = result.results?.filter((r: any) => r.ok).length || 0;
      alert(`✅ Backfill completed in ${elapsed}s\n\nSuccessful: ${successful}/${result.results?.length || 0}`);
      
      // Refresh status
      setTimeout(() => fetchStatus(), 1000);
    } catch (error) {
      console.error('Error backfilling:', error);
      alert(`❌ Backfill failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setBackfilling(false);
    }
  };

  const handleRefresh = async (symbol: string, days: number, force = false) => {
    setRefreshing(symbol);
    try {
      const response = await fetch('/api/admin/history/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: [symbol], days, force }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Refresh failed');
      }
      
      const result = await response.json();
      const symbolResult = result.results?.find((r: any) => r.symbol === symbol);
      
      if (symbolResult?.ok) {
        alert(
          `Refresh completed for ${symbol}:\n` +
          `- Points merged: ${symbolResult.merged}\n` +
          `- Total points: ${symbolResult.total}\n` +
          `- Days updated: ${symbolResult.updated_days}`
        );
      } else {
        alert(`Refresh failed for ${symbol}: ${symbolResult?.error || 'Unknown error'}`);
      }
      
      // Refresh status
      setTimeout(() => fetchStatus(), 2000);
    } catch (error) {
      console.error('Error refreshing:', error);
      alert(`Refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRefreshing(null);
      setShowRefreshModal(false);
      setRefreshSymbol(null);
    }
  };

  const handleClear = async (symbol: string) => {
    if (!confirm(`Are you sure you want to delete all historical data for ${symbol}? This action cannot be undone.`)) {
      return;
    }

    setClearing(symbol);
    try {
      const response = await fetch('/api/admin/history/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });

      if (!response.ok) throw new Error('Clear failed');
      
      alert(`Historical data for ${symbol} has been cleared.`);
      fetchStatus();
      setSelectedSymbol(null);
    } catch (error) {
      console.error('Error clearing:', error);
      alert('Failed to clear history.');
    } finally {
      setClearing(null);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const selectedStatus = selectedSymbol ? statuses.find(s => s.symbol === selectedSymbol) : null;

  return (
    <div className="bg-[#181818] border border-[#222] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#f5f5e8]">History Store</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#222] rounded transition-colors"
          >
            <X size={18} className="text-[#a9a9a9]" />
          </button>
        )}
      </div>

      {/* Auto Refresh Control */}
      <div className="mb-4">
        <HistoryRefreshControl />
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => handleBackfill(false)}
          disabled={backfilling}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-[#181818] text-[#f5f5e8] border border-[#222] hover:border-[#3a3a3a] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={cn(backfilling && "animate-spin")} />
          Backfill All (Full History)
        </button>
        <button
          onClick={() => handleBackfill(true)}
          disabled={backfilling}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-[#ff4d4d]/20 text-[#ff4d4d] border border-[#ff4d4d]/30 hover:bg-[#ff4d4d]/30 transition-colors disabled:opacity-50"
        >
          Force Rebuild
        </button>
        <button
          onClick={async () => {
            if (!confirm('Backfill solo DOGE ed ETH (full history, force)?')) return;
            setBackfilling(true);
            const startTime = Date.now();
            try {
              const response = await fetch('/api/admin/history/backfill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols: ['DOGE', 'ETH'], force: true }),
              });
              const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
              const result = await response.json();
              if (result.success) {
                const successful = result.results?.filter((r: any) => r.ok).length || 0;
                alert(`✅ Backfill DOGE/ETH completed in ${elapsed}s\n\nSuccessful: ${successful}/2\n\nDetails:\n${JSON.stringify(result.results, null, 2)}`);
              } else {
                alert(`❌ Backfill failed: ${result.error}`);
              }
              fetchStatus();
            } catch (error) {
              alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
            } finally {
              setBackfilling(false);
            }
          }}
          disabled={backfilling}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-[#00b686]/20 text-[#00b686] border border-[#00b686]/30 hover:bg-[#00b686]/30 transition-colors disabled:opacity-50"
          title="Backfill solo DOGE ed ETH"
        >
          🔄 Fix DOGE/ETH
        </button>
        <button
          onClick={async () => {
            if (!confirm('Test refresh for BTC (7 days, force=true)?')) return;
            try {
              const start = Date.now();
              const response = await fetch('/api/admin/history/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols: ['BTC'], days: 7, force: true }),
              });
              const elapsed = ((Date.now() - start) / 1000).toFixed(2);
              const result = await response.json();
              if (result.success) {
                alert(`✅ Test completed in ${elapsed}s\n\n${JSON.stringify(result.summary, null, 2)}`);
              } else {
                alert(`❌ Test failed: ${result.error}`);
              }
              fetchStatus();
            } catch (error) {
              alert(`❌ Test error: ${error instanceof Error ? error.message : 'Unknown'}`);
            }
          }}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-[#00b686]/20 text-[#00b686] border border-[#00b686]/30 hover:bg-[#00b686]/30 transition-colors"
          title="Quick test: Refresh BTC 7 days"
        >
          🧪 Test Refresh
        </button>
      </div>

      {/* Status Table */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="animate-spin text-[#a9a9a9]" size={24} />
        </div>
      ) : (
        <div className="space-y-2">
          {statuses.map((status) => (
            <div
              key={status.symbol}
              onClick={() => setSelectedSymbol(status.symbol === selectedSymbol ? null : status.symbol)}
              className={cn(
                "p-3 border rounded cursor-pointer transition-colors",
                status.symbol === selectedSymbol
                  ? "border-[#3a3a3a] bg-[#141414]"
                  : "border-[#222] hover:border-[#3a3a3a]"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {status.available ? (
                    <CheckCircle2 size={18} className="text-[#00b686]" />
                  ) : (
                    <AlertCircle size={18} className="text-[#a9a9a9]" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-[#f5f5e8]">{status.symbol}</div>
                    <div className="text-xs text-[#a9a9a9]">
                      {status.available ? (
                        <>
                          {status.points.toLocaleString()} points • 
                          Confidence: {((status.confidence || 0) * 100).toFixed(1)}% • 
                          {(status.footprint_bytes / 1024).toFixed(1)} KB
                          {status.last_updated && (
                            <> • Updated: {new Date(status.last_updated).toLocaleDateString()}</>
                          )}
                        </>
                      ) : (
                        'Not backfilled'
                      )}
                    </div>
                  </div>
                </div>
                {status.available && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRefreshSymbol(status.symbol);
                        setShowRefreshModal(true);
                      }}
                      disabled={refreshing === status.symbol}
                      className="p-1 text-[#00b686] hover:bg-[#00b686]/10 rounded transition-colors disabled:opacity-50"
                      title="Refresh from CoinGecko"
                    >
                      <RefreshCw size={16} className={cn(refreshing === status.symbol && "animate-spin")} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClear(status.symbol);
                      }}
                      disabled={clearing === status.symbol}
                      className="p-1 text-[#ff4d4d] hover:bg-[#ff4d4d]/10 rounded transition-colors disabled:opacity-50"
                      title="Clear history"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sidebar */}
      {selectedSymbol && selectedStatus && (
        <div className="fixed top-0 right-0 w-[35%] h-full bg-[#181818] border-l border-[#222] z-50 flex flex-col">
          <div className="p-4 border-b border-[#222] bg-[#141414]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-[#f5f5e8]">{selectedSymbol} History Details</h3>
              <button
                onClick={() => setSelectedSymbol(null)}
                className="p-1 hover:bg-[#222] rounded transition-colors"
              >
                <X size={20} className="text-[#a9a9a9]" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-[#f5f5e8] mb-2">Metadata</h4>
              <div className="bg-[#0c0c0d] border border-[#222] rounded p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#a9a9a9]">Points:</span>
                  <span className="text-[#f5f5e8]">{selectedStatus.points.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a9a9a9]">Confidence:</span>
                  <span className="text-[#f5f5e8]">{((selectedStatus.confidence || 0) * 100).toFixed(1)}%</span>
                </div>
                {selectedStatus.last_updated && (
                  <div className="flex justify-between">
                    <span className="text-[#a9a9a9]">Last Updated:</span>
                    <span className="text-[#f5f5e8]">{new Date(selectedStatus.last_updated).toLocaleString()}</span>
                  </div>
                )}
                {selectedStatus.updated_days > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#a9a9a9]">Days Updated:</span>
                    <span className="text-[#f5f5e8]">{selectedStatus.updated_days}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#a9a9a9]">Sources:</span>
                  <span className="text-[#f5f5e8]">{selectedStatus.sources_used.join(', ') || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a9a9a9]">From:</span>
                  <span className="text-[#f5f5e8]">{selectedStatus.from ? new Date(selectedStatus.from).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a9a9a9]">To:</span>
                  <span className="text-[#f5f5e8]">{selectedStatus.to ? new Date(selectedStatus.to).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a9a9a9]">Size:</span>
                  <span className="text-[#f5f5e8]">{(selectedStatus.footprint_bytes / 1024).toFixed(1)} KB</span>
                </div>
              </div>
            </div>

            {selectedStatus.years.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-[#f5f5e8] mb-2">Years Stored</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedStatus.years.map(year => (
                    <span
                      key={year}
                      className="px-2 py-1 text-xs bg-[#141414] border border-[#222] rounded text-[#f5f5e8]"
                    >
                      {year}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedStatus.missing_years.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-yellow-500 mb-2">Missing Years</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedStatus.missing_years.map(year => (
                    <span
                      key={year}
                      className="px-2 py-1 text-xs bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-500"
                    >
                      {year}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Refresh Modal */}
      {showRefreshModal && refreshSymbol && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#181818] border border-[#222] rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-[#f5f5e8] mb-4">
              Force Update from CoinGecko
            </h3>
            <p className="text-sm text-[#a9a9a9] mb-4">
              Refresh historical data for <strong>{refreshSymbol}</strong> from CoinGecko.
              This will merge new data with existing history.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#f5f5e8] mb-2">
                Days to fetch (1-365):
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={refreshDays}
                onChange={(e) => setRefreshDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 30)))}
                className="w-full px-3 py-2 bg-[#0c0c0d] border border-[#222] rounded text-[#f5f5e8] focus:border-[#3a3a3a] focus:outline-none"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowRefreshModal(false);
                  setRefreshSymbol(null);
                }}
                className="px-4 py-2 text-sm font-medium bg-[#181818] text-[#f5f5e8] border border-[#222] hover:border-[#3a3a3a] rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRefresh(refreshSymbol, refreshDays, false)}
                disabled={refreshing === refreshSymbol}
                className="px-4 py-2 text-sm font-medium bg-[#00b686]/20 text-[#00b686] border border-[#00b686]/30 hover:bg-[#00b686]/30 rounded transition-colors disabled:opacity-50"
              >
                {refreshing === refreshSymbol ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                onClick={() => handleRefresh(refreshSymbol, refreshDays, true)}
                disabled={refreshing === refreshSymbol}
                className="px-4 py-2 text-sm font-medium bg-[#ff4d4d]/20 text-[#ff4d4d] border border-[#ff4d4d]/30 hover:bg-[#ff4d4d]/30 rounded transition-colors disabled:opacity-50"
              >
                Force
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

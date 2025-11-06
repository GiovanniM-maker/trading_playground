'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Trash2, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    if (!confirm(`Are you sure you want to ${force ? 'force rebuild' : 'backfill'} all historical data? This may take several minutes.`)) {
      return;
    }

    setBackfilling(true);
    try {
      const response = await fetch('/api/admin/history/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });

      if (!response.ok) throw new Error('Backfill failed');
      
      const result = await response.json();
      alert(`Backfill completed. Results: ${result.results?.filter((r: any) => r.ok).length || 0} successful`);
      
      // Refresh status
      setTimeout(() => fetchStatus(), 2000);
    } catch (error) {
      console.error('Error backfilling:', error);
      alert('Backfill failed. Check console for details.');
    } finally {
      setBackfilling(false);
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

      {/* Actions */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => handleBackfill(false)}
          disabled={backfilling}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-[#181818] text-[#f5f5e8] border border-[#222] hover:border-[#3a3a3a] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={cn(backfilling && "animate-spin")} />
          Backfill All
        </button>
        <button
          onClick={() => handleBackfill(true)}
          disabled={backfilling}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-[#ff4d4d]/20 text-[#ff4d4d] border border-[#ff4d4d]/30 hover:bg-[#ff4d4d]/30 transition-colors disabled:opacity-50"
        >
          Force Rebuild
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
                  <div>
                    <div className="font-medium text-[#f5f5e8]">{status.symbol}</div>
                    <div className="text-xs text-[#a9a9a9]">
                      {status.available ? (
                        <>
                          {status.points.toLocaleString()} points • 
                          Confidence: {(status.confidence || 0) * 100}% • 
                          {(status.footprint_bytes / 1024).toFixed(1)} KB
                        </>
                      ) : (
                        'Not backfilled'
                      )}
                    </div>
                  </div>
                </div>
                {status.available && (
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
              <pre className="text-xs bg-[#0c0c0d] border border-[#222] rounded p-3 overflow-x-auto text-[#f5f5e8]">
                {JSON.stringify({
                  symbol: selectedStatus.symbol,
                  available: selectedStatus.available,
                  points: selectedStatus.points,
                  from: selectedStatus.from,
                  to: selectedStatus.to,
                  confidence: selectedStatus.confidence,
                  sources_used: selectedStatus.sources_used,
                  footprint_bytes: selectedStatus.footprint_bytes,
                }, null, 2)}
              </pre>
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
    </div>
  );
}

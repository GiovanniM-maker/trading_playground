'use client';

import { useState } from 'react';
import { ModelsPanel } from './ModelsPanel';
import { ChartPanel } from './ChartPanel';
import { TradesPanel } from './TradesPanel';
import { ChevronRight, ChevronLeft } from 'lucide-react';

export function LayoutShell() {
  const [isModelsOpen, setIsModelsOpen] = useState(true);
  const [isTradesOpen, setIsTradesOpen] = useState(true);

  return (
    <main className="flex w-full min-h-screen overflow-hidden bg-[var(--background)] text-[var(--text-primary)]">
      {/* Left Sidebar - Models */}
      {isModelsOpen ? (
        <aside className="w-72 transition-[width] duration-300 ease-in-out overflow-y-auto border-r border-[var(--border-color)] bg-[var(--panel-bg)] flex-shrink-0 h-screen">
          <ModelsPanel onCollapse={() => setIsModelsOpen(false)} />
        </aside>
      ) : (
        <button
          onClick={() => setIsModelsOpen(true)}
          className="fixed top-[70px] left-2 z-[60] p-2 bg-[var(--panel-bg)] border border-[var(--border-color)] hover:opacity-80 transition hover:bg-[var(--background-alt)] shadow-[0_0_10px_rgba(0,0,0,0.3)]"
          aria-label="Open models panel"
        >
          <ChevronRight size={18} className="text-[var(--text-primary)]" />
        </button>
      )}

      {/* Center - Chart */}
      <div className="flex-1 min-w-0 h-[calc(100vh-90px)] flex flex-col bg-[var(--background)]">
        <ChartPanel />
      </div>

      {/* Right Sidebar - Trades */}
      {isTradesOpen ? (
        <aside className="w-80 transition-[width] duration-300 ease-in-out overflow-y-auto border-l border-[var(--border-color)] bg-[var(--panel-bg)] flex-shrink-0 h-screen">
          <TradesPanel onCollapse={() => setIsTradesOpen(false)} />
        </aside>
      ) : (
        <button
          onClick={() => setIsTradesOpen(true)}
          className="fixed top-[70px] right-2 z-[60] p-2 bg-[var(--panel-bg)] border border-[var(--border-color)] hover:opacity-80 transition hover:bg-[var(--background-alt)] shadow-[0_0_10px_rgba(0,0,0,0.3)]"
          aria-label="Open trades panel"
        >
          <ChevronLeft size={18} className="text-[var(--text-primary)]" />
        </button>
      )}
    </main>
  );
}

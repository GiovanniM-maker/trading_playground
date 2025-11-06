'use client';

import { useEffect } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { LayoutShell } from '@/components/LayoutShell';
import { useSimulationStore } from '@/store/useSimulationStore';

export default function Home() {
  const initialize = useSimulationStore((state) => state.initialize);
  const isPlaying = useSimulationStore((state) => state.isPlaying);
  const speed = useSimulationStore((state) => state.speed);
  const updateSimulation = useSimulationStore((state) => state.updateSimulation);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Global simulation loop
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      updateSimulation();
    }, 3000 / speed);

    return () => clearInterval(interval);
  }, [isPlaying, speed, updateSimulation]);

  return (
    <div className="flex flex-col w-full h-screen bg-[var(--background)] text-[var(--text-primary)] overflow-hidden">
      <HeaderBar />
      <div className="flex-1 min-h-0 overflow-hidden">
        <LayoutShell />
      </div>
    </div>
  );
}

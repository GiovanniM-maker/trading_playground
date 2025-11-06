'use client';

import { HeaderBar } from '@/components/HeaderBar';
import { ControlDashboard } from '@/components/control/ControlDashboard';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { useEffect, useState } from 'react';

export default function ControlPage() {
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    // Get base URL for API calls
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  return (
    <AdminGuard>
      <div className="flex flex-col w-full h-screen bg-[#0c0c0d] text-[#f5f5e8] overflow-hidden">
        <HeaderBar />
        <main className="flex-grow h-[calc(100vh-90px)] overflow-hidden">
          <ControlDashboard baseUrl={baseUrl} />
        </main>
      </div>
    </AdminGuard>
  );
}


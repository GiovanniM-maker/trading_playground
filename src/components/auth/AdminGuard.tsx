'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return; // Still loading

    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=' + encodeURIComponent(window.location.pathname));
      return;
    }

    if (session?.user?.role !== 'admin') {
      router.push('/login?error=Forbidden');
      return;
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0c0c0d] text-[#f5f5e8]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00b686] mx-auto mb-4"></div>
          <p className="text-[#a9a9a9]">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user.role !== 'admin') {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}


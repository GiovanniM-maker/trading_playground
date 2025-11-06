'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { HeaderBar } from '@/components/HeaderBar';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
        setLoading(false);
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full h-screen bg-[#0c0c0d] text-[#f5f5e8] overflow-hidden">
      <HeaderBar />
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-[#181818] border border-[#222] rounded-xl p-8 shadow-2xl">
            <h1 className="text-2xl font-semibold text-[#f5f5e8] uppercase tracking-wide mb-2">
              Admin Login
            </h1>
            <p className="text-sm text-[#a9a9a9] mb-6">
              Sign in to access admin and control panels
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-[#ff4d4d]/20 border border-[#ff4d4d]/30 text-[#ff4d4d] px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[#f5f5e8] mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-[#141414] border border-[#222] rounded-lg text-[#f5f5e8] placeholder-[#a9a9a9] focus:outline-none focus:border-[#3a3a3a] transition-colors"
                  placeholder="admin@example.com"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-[#f5f5e8] mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-[#141414] border border-[#222] rounded-lg text-[#f5f5e8] placeholder-[#a9a9a9] focus:outline-none focus:border-[#3a3a3a] transition-colors"
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full mt-6"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col w-full h-screen bg-[#0c0c0d] text-[#f5f5e8] overflow-hidden">
        <HeaderBar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="bg-[#181818] border border-[#222] rounded-xl p-8 shadow-2xl">
              <div className="animate-pulse">
                <div className="h-6 bg-[#222] rounded mb-2"></div>
                <div className="h-4 bg-[#222] rounded mb-6"></div>
                <div className="space-y-4">
                  <div className="h-10 bg-[#222] rounded"></div>
                  <div className="h-10 bg-[#222] rounded"></div>
                  <div className="h-10 bg-[#222] rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}


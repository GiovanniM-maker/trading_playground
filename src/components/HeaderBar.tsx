'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { useLivePrices } from '@/lib/market/live';
import { LogIn, LogOut, User } from 'lucide-react';

const navLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/live', label: 'Live' },
  { href: '/market', label: 'Market' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/news', label: 'News' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/trades', label: 'Trades' },
  { href: '/positions', label: 'Positions' },
  { href: '/admin-control', label: 'Admin Control' },
];

export function HeaderBar() {
  const pathname = usePathname();
  const { prices, loading } = useLivePrices();
  const { data: session, status } = useSession();
  
  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };
  
  return (
    <header className="flex-shrink-0 z-50 bg-[var(--background-alt)] border-b border-[var(--border-color)]">
      <div className="flex flex-col">
        {/* Main header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <h1 className="text-base font-semibold text-[var(--text-primary)] uppercase tracking-wide">
              AI Trading Battle Royale
            </h1>
            <nav className="flex gap-0 border border-[var(--border-color)] bg-[var(--background)]">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-4 py-2 text-xs font-medium transition-colors border-r border-[var(--border-color)] last:border-r-0",
                    pathname === link.href
                      ? "bg-[var(--panel-bg)] text-[var(--text-primary)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--panel-bg)]"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          
          {/* Auth Status */}
          <div className="flex items-center gap-3">
            {status === 'loading' ? (
              <div className="w-6 h-6 border-2 border-[var(--text-muted)] border-t-transparent rounded-full animate-spin" />
            ) : session ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <User size={14} />
                  <span className="text-[var(--text-primary)]">{session.user.email}</span>
                  {session.user.role === 'admin' && (
                    <span className="px-1.5 py-0.5 bg-[#00b686]/20 text-[#00b686] border border-[#00b686]/30 text-xs font-medium rounded">
                      Admin
                    </span>
                  )}
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--panel-bg)] transition-colors"
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--panel-bg)] transition-colors"
              >
                <LogIn size={14} />
                Login
              </Link>
            )}
          </div>
        </div>
        
        {/* Prices strip */}
        <div className="flex items-center gap-6 px-4 py-2 bg-[var(--background)] border-t border-[var(--border-color)] overflow-x-auto scrollbar-thin">
          {loading && prices.length === 0 ? (
            <div className="text-xs text-[var(--text-muted)]">Loading prices...</div>
          ) : (
            prices.map((price) => (
              <div key={price.symbol} className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-[var(--text-muted)] font-medium">{price.symbol}</span>
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  ${price.price_usd > 0 
                    ? price.price_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '---'}
                </span>
                <span className={cn(
                  "text-xs font-semibold",
                  price.change_24h >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
                )}>
                  {price.change_24h >= 0 ? '+' : ''}{price.change_24h.toFixed(2)}%
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </header>
  );
}


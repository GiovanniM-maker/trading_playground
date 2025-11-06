'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/', label: 'Live' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/trades', label: 'Completed Trades' },
  { href: '/positions', label: 'Positions' },
];

const prices = [
  { asset: 'BTC', price: 50234.56, change: 2.34 },
  { asset: 'ETH', price: 3045.23, change: -1.23 },
  { asset: 'SOL', price: 142.89, change: 5.67 },
];

export function Header() {
  const pathname = usePathname();
  
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0b0c10] border-b border-white/8">
      <div className="flex flex-col">
        {/* Main header */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold text-white">
              🧠 AI Trading Battle Royale
            </h1>
            <nav className="flex gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                    pathname === link.href
                      ? "bg-white/10 text-white"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        
        {/* Prices strip */}
        <div className="flex items-center gap-6 px-6 py-2 bg-black/20 border-t border-white/5">
          {prices.map((price) => (
            <div key={price.asset} className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{price.asset}</span>
              <span className="text-xs font-medium text-white">
                ${price.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={cn(
                "text-xs font-medium",
                price.change >= 0 ? "text-green-400" : "text-red-400"
              )}>
                {price.change >= 0 ? '+' : ''}{price.change.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}

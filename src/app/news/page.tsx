'use client';

import { HeaderBar } from '@/components/HeaderBar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function NewsPage() {
  return (
    <div className="flex flex-col w-full h-screen bg-[#0c0c0d] text-[#f5f5e8] overflow-hidden">
      <HeaderBar />
      <main className="flex-grow h-[calc(100vh-90px)] flex flex-col p-6 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#f5f5e8] uppercase tracking-wide mb-4">
            Crypto News Feed
          </h1>
        </div>

        <Card className="bg-[#181818] border border-[#222]">
          <CardHeader>
            <h2 className="text-lg font-semibold text-[#f5f5e8]">News API</h2>
          </CardHeader>
          <CardContent>
            <p className="text-[#a9a9a9]">
              News API temporarily disabled. You can re-enable it later.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

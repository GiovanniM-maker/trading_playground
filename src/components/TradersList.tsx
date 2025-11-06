'use client';

import { useSimulationStore } from '@/store/useSimulationStore';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function TradersList() {
  const models = useSimulationStore((state) => state.models);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const calculateReturn = (model: typeof models[0]) => {
    return model.returnPercent;
  };

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="fixed left-0 top-[140px] z-40 bg-[#0b0c10] border-r border-y border-white/8 p-2 hover:bg-white/5 transition-colors"
      >
        <ChevronRight className="h-4 w-4 text-gray-400" />
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0b0c10] border-r border-white/8">
      <div className="flex items-center justify-between p-4 border-b border-white/8">
        <h2 className="text-sm font-semibold text-white">Models</h2>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 hover:bg-white/5 rounded transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-gray-400" />
        </button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {models.map((model) => {
            const returnPercent = calculateReturn(model);
            const isPositive = returnPercent >= 0;
            
            return (
              <Card key={model.id} className="bg-[#111] border-white/8 hover:border-white/15 transition-colors">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{model.icon}</span>
                    <span className="text-sm font-medium text-white">{model.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Value:</span>
                    <span className="text-sm font-semibold text-white">
                      ${model.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Return:</span>
                    <span className={cn(
                      "text-sm font-semibold",
                      isPositive ? "text-green-400" : "text-red-400"
                    )}>
                      {isPositive ? '+' : ''}{returnPercent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="pt-2 border-t border-white/5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400">Trades:</span>
                      <span className="text-gray-300">{model.totalTrades}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}


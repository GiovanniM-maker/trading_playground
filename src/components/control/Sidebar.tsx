'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ServiceStatus } from '@/lib/control/status';
import { LogViewer } from './LogViewer';
import { cn } from '@/lib/utils';

interface SidebarProps {
  service: ServiceStatus | null;
  onClose: () => void;
}

export function Sidebar({ service, onClose }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'logs' | 'details' | 'json'>('logs');

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (service) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [service, onClose]);

  if (!service) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OK':
        return 'bg-[#00b686]/20 text-[#00b686] border-[#00b686]/30';
      case 'WARNING':
        return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
      case 'ERROR':
        return 'bg-[#ff4d4d]/20 text-[#ff4d4d] border-[#ff4d4d]/30';
      default:
        return 'bg-[#8A8A8A]/20 text-[#8A8A8A] border-[#8A8A8A]/30';
    }
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 200) return 'text-[#00b686]';
    if (latency < 500) return 'text-yellow-500';
    return 'text-[#ff4d4d]';
  };

  return (
    <AnimatePresence>
      {service && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 w-[35%] h-full bg-[#181818] border-l border-[#222] z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="p-4 border-b border-[#222] bg-[#141414] flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-[#f5f5e8] truncate">
                  {service.name}
                </h2>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-[#222] rounded transition-colors flex-shrink-0"
                >
                  <X size={20} className="text-[#a9a9a9]" />
                </button>
              </div>
              
              <div className="flex items-center gap-4 text-xs text-[#a9a9a9]">
                <span className={cn("px-2 py-1 rounded border", getStatusColor(service.status))}>
                  {service.status}
                </span>
                <span className={cn("font-medium", getLatencyColor(service.latency))}>
                  {service.latency}ms
                </span>
                {service.code && <span>HTTP {service.code}</span>}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#222] bg-[#141414] flex-shrink-0">
              {(['logs', 'details', 'json'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 px-4 py-3 text-sm font-medium transition-colors capitalize",
                    activeTab === tab
                      ? "text-[#f5f5e8] border-b-2 border-[#00b686] bg-[#181818]"
                      : "text-[#a9a9a9] hover:text-[#f5f5e8] hover:bg-[#181818]"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'logs' && (
                <div>
                  <h3 className="text-sm font-semibold text-[#f5f5e8] mb-3">
                    Recent Logs (Last 30)
                  </h3>
                  <LogViewer logs={service.logs || []} />
                </div>
              )}

              {activeTab === 'details' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-[#f5f5e8] mb-3">
                    Service Details
                  </h3>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#a9a9a9]">Service Name:</span>
                      <span className="text-[#f5f5e8] font-medium">{service.name}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-[#a9a9a9]">Status:</span>
                      <span className={cn(
                        "font-medium",
                        service.status === 'OK' ? "text-[#00b686]" :
                        service.status === 'WARNING' ? "text-yellow-500" :
                        "text-[#ff4d4d]"
                      )}>
                        {service.status}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[#a9a9a9]">Response Time:</span>
                      <span className={cn("font-medium", getLatencyColor(service.latency))}>
                        {service.latency}ms
                      </span>
                    </div>

                    {service.code && (
                      <div className="flex justify-between">
                        <span className="text-[#a9a9a9]">HTTP Status:</span>
                        <span className="text-[#f5f5e8] font-medium">
                          {service.code}
                        </span>
                      </div>
                    )}

                    {service.lastUpdate && (
                      <div className="flex justify-between">
                        <span className="text-[#a9a9a9]">Last Update:</span>
                        <span className="text-[#f5f5e8] font-medium">
                          {new Date(service.lastUpdate).toLocaleString()}
                        </span>
                      </div>
                    )}

                    {service.error && (
                      <div className="pt-3 border-t border-[#222]">
                        <span className="text-[#a9a9a9]">Error:</span>
                        <p className="text-[#ff4d4d] text-xs mt-1">{service.error}</p>
                      </div>
                    )}

                    {(service.logs?.length || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#a9a9a9]">Log Entries:</span>
                        <span className="text-[#f5f5e8] font-medium">
                          {service.logs?.length || 0}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'json' && (
                <div>
                  <h3 className="text-sm font-semibold text-[#f5f5e8] mb-3">
                    Raw JSON Response
                  </h3>
                  {service.json && Object.keys(service.json).length > 0 ? (
                    <pre className="text-xs bg-[#0c0c0d] border border-[#222] rounded p-3 overflow-x-auto text-[#f5f5e8]">
                      {JSON.stringify(service.json, null, 2)}
                    </pre>
                  ) : (
                    <div className="text-center py-8 text-[#a9a9a9]">
                      <p>No JSON response data</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}


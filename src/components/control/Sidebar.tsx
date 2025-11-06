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
  const [activeTab, setActiveTab] = useState<'logs' | 'details' | 'json' | 'fallbacks'>('logs');
  const [logs, setLogs] = useState(service?.logs || []);
  const [fallbacks, setFallbacks] = useState<Array<{ timestamp: string; cause: string }>>([]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (service) {
      document.addEventListener('keydown', handleEscape);
      
      // Fetch fresh logs when service is selected
      const fetchLogs = async () => {
        try {
          const response = await fetch(`/api/control/logs?service=${encodeURIComponent(service.name)}`);
          if (response.ok) {
            const data = await response.json();
            setLogs(data.logs || []);
          }
        } catch (error) {
          console.error('Error fetching logs:', error);
        }
      };

      // Fetch fallback logs for Sentiment System
      const fetchFallbacks = async () => {
        if (service.name === 'Sentiment System' || service.name === 'Hugging Face') {
          try {
            const response = await fetch('/api/control/sentiment-fallbacks');
            if (response.ok) {
              const data = await response.json();
              setFallbacks(data.fallbacks || []);
            }
          } catch (error) {
            console.error('Error fetching fallbacks:', error);
          }
        }
      };

      fetchLogs();
      fetchFallbacks();
      
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    } else {
      setLogs([]);
    }
  }, [service, onClose]);

  // Update logs when service changes
  useEffect(() => {
    if (service) {
      setLogs(service.logs || []);
    }
  }, [service]);

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
            <div className="flex border-b border-[#222] bg-[#141414] flex-shrink-0 overflow-x-auto">
              {(['logs', 'details', 'json', ...(service.name === 'Sentiment System' || service.name === 'Hugging Face' ? ['fallbacks'] : [])] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as typeof activeTab)}
                  className={cn(
                    "px-4 py-3 text-sm font-medium transition-colors capitalize whitespace-nowrap",
                    activeTab === tab
                      ? "text-[#f5f5e8] border-b-2 border-[#00b686] bg-[#181818]"
                      : "text-[#a9a9a9] hover:text-[#f5f5e8] hover:bg-[#181818]"
                  )}
                >
                  {tab}
                  {tab === 'fallbacks' && fallbacks.length > 0 && (
                    <span className="ml-1 text-xs text-yellow-500">({fallbacks.length})</span>
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'logs' && (
                <div>
                  <h3 className="text-sm font-semibold text-[#f5f5e8] mb-3">
                    Recent Logs (Last {logs.length})
                  </h3>
                  <LogViewer logs={logs} />
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

              {activeTab === 'fallbacks' && (
                <div>
                  <h3 className="text-sm font-semibold text-[#f5f5e8] mb-3">
                    Sentiment Fallback Logs (Last {fallbacks.length})
                  </h3>
                  {fallbacks.length > 0 ? (
                    <div className="space-y-2">
                      {fallbacks.map((fallback, index) => {
                        const timestamp = new Date(fallback.timestamp);
                        const isRecent = Date.now() - timestamp.getTime() < 24 * 60 * 60 * 1000; // Last 24h
                        
                        return (
                          <div
                            key={index}
                            className={cn(
                              "p-3 bg-[#0c0c0d] border rounded text-xs",
                              isRecent ? "border-yellow-500/50 bg-yellow-500/5" : "border-[#222]"
                            )}
                          >
                            <div className="flex items-start justify-between mb-1">
                              <span className={cn("font-medium", isRecent ? "text-yellow-500" : "text-[#f5f5e8]")}>
                                {timestamp.toLocaleString()}
                              </span>
                              {isRecent && (
                                <span className="text-yellow-500 text-xs">Last 24h</span>
                              )}
                            </div>
                            <div className="text-[#a9a9a9]">
                              Cause: <span className="text-[#f5f5e8]">{fallback.cause}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-[#a9a9a9]">
                      <p>No fallback events recorded</p>
                      <p className="text-xs mt-2">Fallbacks occur when HuggingFace API fails (401, 404, 410)</p>
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


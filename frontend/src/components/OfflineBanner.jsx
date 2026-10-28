import React from 'react';
import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function OfflineBanner() {
  const { isOnline, offlineQueueCount, syncStatus } = useAuth();

  if (isOnline && offlineQueueCount === 0 && !syncStatus) {
    return null;
  }

  return (
    <div className="bg-amber-950/90 border-b border-amber-600/40 text-amber-200 px-4 py-2.5 text-xs sm:text-sm backdrop-blur-md sticky top-0 z-50 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
          )}
          <span>
            {!isOnline ? (
              <>
                <strong>Offline Mode:</strong> Internet disconnected. Check-ins and emergency actions will be safely stored in IndexedDB.
              </>
            ) : syncStatus ? (
              syncStatus
            ) : (
              `${offlineQueueCount} event(s) pending synchronization.`
            )}
          </span>
        </div>

        {offlineQueueCount > 0 && (
          <span className="bg-amber-800/80 text-amber-100 font-semibold px-2 py-0.5 rounded-full text-[11px] shrink-0">
            {offlineQueueCount} queued
          </span>
        )}
      </div>
    </div>
  );
}

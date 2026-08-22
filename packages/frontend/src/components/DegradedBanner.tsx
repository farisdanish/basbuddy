import { AlertTriangle, WifiOff } from 'lucide-react';
import type { UseSystemHealthResult } from '../hooks/useSystemHealth.ts';

interface DegradedBannerProps {
  health: UseSystemHealthResult;
}

export function DegradedBanner({ health }: DegradedBannerProps) {
  if (!health.isDegraded) return null;

  const isOffline = !health.isOnline;

  return (
    <aside
      aria-label="Feed status banner"
      className={`absolute top-20 left-4 right-4 z-20 max-w-md mx-auto flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-sans shadow-xl backdrop-blur-md border animate-in slide-in-from-top-2 duration-200 ${
        isOffline
          ? 'bg-rose-950/80 border-rose-500/30 text-rose-200'
          : 'bg-amber-950/80 border-amber-500/30 text-amber-200'
      }`}
    >
      {isOffline ? (
        <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
      ) : (
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
      )}
      <span className="leading-tight">
        {isOffline
          ? '⚡ Offline Mode — Showing saved favorites and cached schedules.'
          : '⚠️ Live GPS feed delayed (data.gov.my). Showing schedule estimates.'}
      </span>
    </aside>
  );
}

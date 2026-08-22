import type { FreshnessStatus, StopArrival } from '@basbuddy/shared';

// ─── Utility: format ETA seconds to human-readable string ────────────────────

export function formatEta(etaSeconds: number): string {
  if (etaSeconds < 60) return 'Arriving';
  const mins = Math.round(etaSeconds / 60);
  if (mins === 1) return '1 min';
  return `${mins} mins`;
}

// ─── Utility: freshness → CSS class ──────────────────────────────────────────

export function freshnessClass(freshness: FreshnessStatus): string {
  switch (freshness) {
    case 'live':        return 'live';
    case 'stale':       return 'stale';
    case 'signal_lost': return 'signal-lost';
    default:            return 'signal-lost';
  }
}

// ─── ArrivalRow component ─────────────────────────────────────────────────────

interface ArrivalRowProps {
  arrival: StopArrival;
  onSelectRoute?: (routeId: string) => void;
}

export function ArrivalRow({ arrival, onSelectRoute }: ArrivalRowProps) {
  const cls = freshnessClass(arrival.freshness);

  return (
    <div className="flex items-center justify-between py-3.5 border-b border-white/5 last:border-0 hover:bg-white/[0.02] px-2 rounded-xl transition-colors">
      <div className="flex items-center gap-3.5 min-w-0 pr-2">
        {/* Route number badge */}
        <button
          type="button"
          onClick={() => onSelectRoute?.(arrival.routeId)}
          title={`Highlight route ${arrival.routeShortName}`}
          className="flex items-center justify-center min-w-[48px] h-9 px-2 rounded-lg bg-[#F4A100] text-[#101B2D] font-display text-lg font-bold shadow-md hover:scale-105 active:scale-95 transition-all shrink-0 select-none"
        >
          {arrival.routeShortName}
        </button>

        <div className="min-w-0">
          <p className="text-sm font-sans font-semibold text-[#FFF8EE] truncate">
            {arrival.tripHeadsign}
          </p>
          <p className="text-xs font-sans text-[#FFF8EE]/50 flex items-center gap-1.5 mt-0.5">
            {arrival.source === 'schedule' ? (
              <span>Schedule estimate</span>
            ) : arrival.freshness === 'stale' ? (
              <span className="text-amber-400/80">Stale GPS feed</span>
            ) : (
              <span className="text-emerald-400/80">Live vehicle tracked</span>
            )}
          </p>
        </div>
      </div>

      {/* ETA pill */}
      <div className={`eta-pill ${cls} shrink-0 select-none`}>
        {arrival.freshness === 'live' && <span className="live-dot" />}
        <span className="font-data font-medium text-xs">
          {formatEta(arrival.etaSeconds)}
        </span>
      </div>
    </div>
  );
}

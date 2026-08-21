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
  }
}

// ─── ArrivalRow component ─────────────────────────────────────────────────────

interface ArrivalRowProps {
  arrival: StopArrival;
}

export function ArrivalRow({ arrival }: ArrivalRowProps) {
  const cls = freshnessClass(arrival.freshness);

  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)] last:border-0">
      <div className="flex items-center gap-3">
        {/* Route number badge */}
        <span
          className="font-display text-lg font-bold px-2 py-0.5 rounded"
          style={{ background: 'var(--color-mango-peel)', color: 'var(--color-harbour-navy)' }}
        >
          {arrival.routeShortName}
        </span>
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">{arrival.tripHeadsign}</p>
          {arrival.source === 'schedule' && (
            <p className="text-xs text-[var(--text-muted)]">Schedule estimate</p>
          )}
        </div>
      </div>

      {/* ETA pill */}
      <div className={`eta-pill ${cls}`}>
        {arrival.freshness === 'live' && <span className="live-dot" />}
        <span className="font-data">{formatEta(arrival.etaSeconds)}</span>
      </div>
    </div>
  );
}

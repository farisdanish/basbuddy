import { Drawer } from 'vaul';
import { useStopEtas } from '../../hooks/useStopEtas.ts';
import { ArrivalRow } from './ArrivalRow.tsx';

// ─── StopSheet ────────────────────────────────────────────────────────────────
// Vaul bottom sheet — opens when a stop is tapped on the map.
// Shows live ETAs (or schedule fallback) for all upcoming buses at that stop.

interface StopSheetProps {
  stopId: string | null;
  onClose: () => void;
}

export function StopSheet({ stopId, onClose }: StopSheetProps) {
  const { data, loading, error } = useStopEtas(stopId);
  const open = stopId !== null;

  return (
    <Drawer.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm" />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-30 rounded-t-2xl"
          style={{ background: 'var(--bg-surface)', maxHeight: '80vh' }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div
              className="rounded-full"
              style={{ width: 40, height: 4, background: 'var(--text-muted)' }}
            />
          </div>

          <div className="px-4 pb-4 overflow-y-auto basbuddy-scroll" style={{ maxHeight: 'calc(80vh - 32px)' }}>
            {/* Stop header */}
            {data && (
              <div className="mb-4">
                <Drawer.Title
                  className="font-display text-2xl font-bold"
                  style={{ color: 'var(--color-mango-peel)' }}
                >
                  {data.stopName || stopId}
                </Drawer.Title>
                <p className="text-xs font-data" style={{ color: 'var(--text-muted)' }}>
                  Stop {stopId} · Updated {new Date(data.generatedAt).toLocaleTimeString('en-MY', {
                    timeZone: 'Asia/Kuala_Lumpur',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            )}

            {/* ETA disclaimer (§3) */}
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              ⚠️ Arrival times are estimates only, not guaranteed.
            </p>

            {/* Content states */}
            {loading && !data && (
              <p style={{ color: 'var(--text-secondary)' }}>Loading ETAs…</p>
            )}
            {error && (
              <p style={{ color: 'var(--color-ember-coral)' }}>Failed to load ETAs: {error}</p>
            )}
            {data && data.arrivals.length === 0 && (
              <p style={{ color: 'var(--text-secondary)' }}>
                No upcoming buses in the next hour.
              </p>
            )}
            {data && data.arrivals.map((arrival) => (
              <ArrivalRow key={`${arrival.tripId}-${arrival.etaSeconds}`} arrival={arrival} />
            ))}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

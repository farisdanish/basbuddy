import { useState } from 'react';
import { Drawer } from 'vaul';
import { Star, Share2, Check, Clock, AlertCircle } from 'lucide-react';
import type { StopArrival } from '@basbuddy/shared';
import { useStopEtas } from '../../hooks/useStopEtas.ts';
import { useFavorites } from '../../hooks/useFavorites.ts';
import { ArrivalRow } from './ArrivalRow.tsx';

interface StopSheetProps {
  stopId: string | null;
  onClose: () => void;
  onSelectRoute?: (routeId: string) => void;
}

export function StopSheet({ stopId, onClose, onSelectRoute }: StopSheetProps) {
  const { data, loading, error } = useStopEtas(stopId);
  const { favorites, addFavorite, removeFavorite } = useFavorites();
  const [copied, setCopied] = useState(false);

  const open = stopId !== null;

  const existingFav = favorites.find((f) => f.stopId === stopId);
  const isFavorite = Boolean(existingFav);

  const handleToggleFavorite = async () => {
    if (!stopId) return;
    if (existingFav) {
      await removeFavorite(existingFav.id);
    } else {
      await addFavorite({
        stopId,
        label: data?.stopName || `Stop ${stopId}`,
      });
    }
  };

  const handleShare = async () => {
    if (!stopId) return;
    const url = `${window.location.origin}/?stop=${stopId}`;
    const shareData = {
      title: `BasBuddy - Stop ${data?.stopName || stopId}`,
      text: `Live bus arrival times for ${data?.stopName || stopId} on BasBuddy`,
      url,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignored
    }
  };

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-40 rounded-t-3xl bg-[#182337] border-t border-white/10 shadow-2xl flex flex-col max-h-[85vh]">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
            <div className="w-10 h-1.5 rounded-full bg-white/20" />
          </div>

          <div className="px-5 pb-6 overflow-y-auto basbuddy-scroll flex-1">
            {/* Header section */}
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="min-w-0 flex-1">
                <Drawer.Title className="font-display text-2xl font-bold text-[#F4A100] tracking-tight leading-tight truncate">
                  {data?.stopName || (stopId ? `Stop ${stopId}` : 'Loading stop...')}
                </Drawer.Title>
                <Drawer.Description className="sr-only">
                  Upcoming bus arrivals and schedule timetable for this stop.
                </Drawer.Description>
                <div className="flex items-center gap-2 mt-1 text-xs font-mono text-[#FFF8EE]/50">
                  <span>Stop ID: {stopId}</span>
                  {data?.generatedAt && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#F4A100]" />
                        {new Date(data.generatedAt).toLocaleTimeString('en-MY', {
                          timeZone: 'Asia/Kuala_Lumpur',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Action buttons (Favorite + Share) */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  aria-label={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
                  className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all active:scale-90 ${
                    isFavorite
                      ? 'bg-[#F4A100]/20 border-[#F4A100]/50 text-[#F4A100]'
                      : 'bg-white/5 border-white/10 text-[#FFF8EE]/70 hover:bg-white/10 hover:text-[#FFF8EE]'
                  }`}
                >
                  <Star className={`w-5 h-5 ${isFavorite ? 'fill-[#F4A100]' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  aria-label="Share stop"
                  className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-[#FFF8EE]/70 hover:bg-white/10 hover:text-[#FFF8EE] transition-all active:scale-90"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Share2 className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Legal ETA disclaimer */}
            <div className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-white/[0.03] border border-white/5 text-[11px] font-sans text-[#FFF8EE]/50 mb-4 select-none">
              <span>⚠️</span>
              <span>Arrival times are computed estimates. Actual bus arrival may vary with traffic.</span>
            </div>

            {/* Content states */}
            {loading && !data && (
              <div className="flex items-center justify-center py-10 text-sm font-sans text-[#FFF8EE]/50 gap-2">
                <div className="w-4 h-4 border-2 border-[#F4A100] border-t-transparent rounded-full animate-spin" />
                <span>Checking real-time arrivals...</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm my-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>Unable to load arrivals: {error}</span>
              </div>
            )}

            {data && data.arrivals.length === 0 && (
              <div className="text-center py-10 px-4 rounded-2xl bg-white/[0.02] border border-white/5 my-2">
                <span className="text-2xl block mb-2">🌙</span>
                <p className="text-sm font-sans font-medium text-[#FFF8EE]">
                  No upcoming buses scheduled
                </p>
                <p className="text-xs font-sans text-[#FFF8EE]/50 mt-1">
                  Service may be closed for the night or no trips active in the next 90 minutes.
                </p>
              </div>
            )}

            {/* Arrivals List */}
            {data && data.arrivals.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-mono uppercase tracking-wider text-[#FFF8EE]/40 px-2 mb-1">
                  Upcoming Arrivals ({data.arrivals.length})
                </div>
                {data.arrivals.map((arrival: StopArrival) => (
                  <ArrivalRow
                    key={`${arrival.tripId}-${arrival.etaSeconds}`}
                    arrival={arrival}
                    onSelectRoute={onSelectRoute}
                  />
                ))}
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

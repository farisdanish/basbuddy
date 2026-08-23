import { useState } from 'react';
import { Drawer } from 'vaul';
import { Star, Share2, Check, Clock, AlertCircle, Calendar, Radio } from 'lucide-react';
import type { StopArrival } from '@basbuddy/shared';
import { useStopEtas } from '../../hooks/useStopEtas.ts';
import { useStopTimetable } from '../../hooks/useStopTimetable.ts';
import { useFavorites } from '../../hooks/useFavorites.ts';
import { ArrivalRow } from './ArrivalRow.tsx';

interface StopSheetProps {
  stopId: string | null;
  onClose: () => void;
  onSelectRoute?: (routeId: string) => void;
}

export function StopSheet({ stopId, onClose, onSelectRoute }: StopSheetProps) {
  const [tab, setTab] = useState<'arrivals' | 'timetable'>('arrivals');
  const { data, loading, error } = useStopEtas(stopId);
  const { data: timetableData, loading: timetableLoading } = useStopTimetable(stopId);
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

  const formatTimeDisplay = (timeStr?: string | null) => {
    if (!timeStr) return 'N/A';
    const parts = timeStr.split(':');
    let h = parseInt(parts[0] ?? '0', 10);
    const m = parts[1] ?? '00';
    if (h >= 24) h -= 24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 === 0 ? 12 : h % 12;
    return `${formattedH}:${m} ${ampm}`;
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
                  {data?.stopName || timetableData?.stopName || (stopId ? `Stop ${stopId}` : 'Loading stop...')}
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

            {/* Tab navigation pills */}
            <div className="flex items-center gap-2 mb-3 bg-[#101B2D]/60 p-1 rounded-xl border border-white/5">
              <button
                type="button"
                onClick={() => setTab('arrivals')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-sans font-medium transition-all ${
                  tab === 'arrivals'
                    ? 'bg-[#1F7A6C] text-[#FFF8EE] shadow-sm'
                    : 'text-[#FFF8EE]/60 hover:text-[#FFF8EE]'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Upcoming Arrivals</span>
              </button>

              <button
                type="button"
                onClick={() => setTab('timetable')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-sans font-medium transition-all ${
                  tab === 'timetable'
                    ? 'bg-[#1F7A6C] text-[#FFF8EE] shadow-sm'
                    : 'text-[#FFF8EE]/60 hover:text-[#FFF8EE]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Full Daily Timetable</span>
              </button>
            </div>

            {tab === 'arrivals' ? (
              <>
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
                  <div className="text-center py-8 px-4 rounded-2xl bg-white/[0.02] border border-white/5 my-2">
                    <span className="text-2xl block mb-2">🌙</span>
                    <p className="text-sm font-sans font-medium text-[#FFF8EE]">
                      No buses arriving in the next 90 minutes
                    </p>
                    <p className="text-xs font-sans text-[#FFF8EE]/50 mt-1 mb-3">
                      Service may be closed for the night or operating on intermittent schedules.
                    </p>
                    <button
                      type="button"
                      onClick={() => setTab('timetable')}
                      className="px-3 py-1.5 rounded-xl bg-[#F4A100] text-[#101B2D] text-xs font-sans font-bold shadow-md hover:bg-[#F4A100]/90 transition-all active:scale-95"
                    >
                      View Full Daily Timetable
                    </button>
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
              </>
            ) : (
              <div className="space-y-3">
                {timetableLoading && !timetableData && (
                  <div className="flex items-center justify-center py-10 text-sm font-sans text-[#FFF8EE]/50 gap-2">
                    <div className="w-4 h-4 border-2 border-[#F4A100] border-t-transparent rounded-full animate-spin" />
                    <span>Loading daily timetable...</span>
                  </div>
                )}

                {timetableData && timetableData.departures.length === 0 && (
                  <div className="text-center py-8 text-sm font-sans text-[#FFF8EE]/50">
                    No scheduled timetable departures found for today.
                  </div>
                )}

                {timetableData && timetableData.departures.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-mono uppercase tracking-wider text-[#FFF8EE]/40 px-1">
                      Today's Scheduled Departures ({timetableData.departures.length})
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 max-h-[50vh] overflow-y-auto basbuddy-scroll pr-1">
                      {timetableData.departures.map((dep, idx) => (
                        <div
                          key={`${dep.tripId}-${dep.departureTime}-${idx}`}
                          onClick={() => onSelectRoute && onSelectRoute(dep.routeId)}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-[#1F7A6C]/50 hover:bg-[#1F7A6C]/20 transition-all cursor-pointer group active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex items-center justify-center px-2 py-0.5 rounded-lg bg-[#F4A100] text-[#101B2D] font-display text-sm font-bold shadow-sm select-none shrink-0">
                              {dep.routeShortName}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-sans font-medium text-[#FFF8EE] truncate group-hover:text-[#F4A100] transition-colors">
                                ➔ {dep.tripHeadsign || `Route ${dep.routeShortName}`}
                              </div>
                              <div className="text-[10px] font-mono text-[#FFF8EE]/40">
                                Dir {dep.directionId === 0 ? 'Outbound' : 'Inbound'}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-xs font-mono font-bold text-[#FFF8EE]">
                              {formatTimeDisplay(dep.departureTime)}
                            </div>
                            <div className="text-[9px] font-sans text-[#FFF8EE]/40">
                              Scheduled
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

import { useState } from 'react';
import { X, Navigation, Radio, Star, Calendar, Clock, AlertCircle } from 'lucide-react';
import type { RouteDetailsResponse } from '@basbuddy/shared';
import { useFavorites } from '../../hooks/useFavorites.ts';
import { RouteTimetableModal } from './RouteTimetableModal.tsx';

interface RouteTrackerSheetProps {
  routeData: RouteDetailsResponse | null;
  loading: boolean;
  onClose: () => void;
  onSelectStop: (stopId: string) => void;
}

export function RouteTrackerSheet({
  routeData,
  loading: _loading,
  onClose,
  onSelectStop,
}: RouteTrackerSheetProps) {
  const [activeDirectionIndex, setActiveDirectionIndex] = useState(0);
  const [timetableOpen, setTimetableOpen] = useState(false);
  const { favorites, addFavorite, removeFavorite } = useFavorites();

  const vehiclesCount = routeData?.vehicles?.length ?? 0;
  const directions = routeData?.directions ?? [];
  const timetable = routeData?.timetable;

  const existingRouteFav = routeData?.routeId
    ? favorites.find((f) => f.routeId === routeData.routeId && !f.stopId)
    : undefined;
  const isFavorite = Boolean(existingRouteFav);

  const handleToggleFavorite = async () => {
    if (!routeData) return;
    if (existingRouteFav) {
      await removeFavorite(existingRouteFav.id);
    } else {
      await addFavorite({
        routeId: routeData.routeId,
        label: `Route ${routeData.routeShortName}`,
      });
    }
  };

  const nextDeparture = timetable?.nextDepartures?.[0];

  const formatTimeDisplay = (timeStr: string) => {
    const parts = timeStr.split(':');
    let h = parseInt(parts[0] ?? '0', 10);
    const m = parts[1] ?? '00';
    const nextDay = h >= 24;
    if (nextDay) h -= 24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 === 0 ? 12 : h % 12;
    return `${formattedH}:${m} ${ampm}${nextDay ? ' (+1)' : ''}`;
  };

  return (
    <>
      <aside
        aria-label="Route inspector"
        data-testid="route-inspector"
        className="absolute top-20 left-4 right-4 z-30 max-w-md mx-auto md:left-6 md:right-auto md:top-20 md:w-96 md:max-w-none md:mx-0 flex flex-col rounded-2xl bg-[#182337]/95 border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden transition-all"
      >
        {/* Route Header */}
        <div className="flex items-center justify-between gap-3 p-4 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center min-w-[44px] h-9 px-2.5 rounded-xl bg-[#F4A100] text-[#101B2D] font-display text-lg font-bold shadow-md shrink-0 select-none">
              {routeData?.routeShortName || '...'}
            </div>

            <div className="min-w-0">
              <h2 className="text-sm font-sans font-bold text-[#FFF8EE] truncate">
                {routeData?.routeLongName || 'Loading route...'}
              </h2>
              <div className="flex items-center gap-2 mt-0.5 text-xs font-mono text-[#FFF8EE]/60">
                <span className={`flex items-center gap-1 ${vehiclesCount > 0 ? 'text-[#E94B8C]' : 'text-amber-400/80'}`}>
                  <Radio className={`w-3 h-3 ${vehiclesCount > 0 ? 'animate-pulse' : ''}`} />
                  {vehiclesCount} {vehiclesCount === 1 ? 'bus live' : 'buses live'}
                </span>
                {routeData?.stops && (
                  <>
                    <span>•</span>
                    <span>{routeData.stops.length} stops</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {routeData && (
              <button
                type="button"
                onClick={handleToggleFavorite}
                aria-label={isFavorite ? 'Remove route from favorites' : 'Save route to favorites'}
                className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all active:scale-95 ${
                  isFavorite
                    ? 'bg-[#F4A100]/20 border-[#F4A100]/50 text-[#F4A100]'
                    : 'bg-white/5 border-white/10 text-[#FFF8EE]/70 hover:bg-white/10 hover:text-[#FFF8EE]'
                }`}
              >
                <Star className={`w-4 h-4 ${isFavorite ? 'fill-[#F4A100]' : ''}`} />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close route inspector"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-[#FFF8EE]/80 hover:text-[#FFF8EE] active:scale-95 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live vs Schedule Status & Timetable Notice */}
        <div className="px-4 py-2.5 bg-[#101B2D]/70 border-b border-white/5">
          {vehiclesCount === 0 ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-[11px] font-sans text-amber-200/90 leading-tight">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  No live GPS telemetry in open feed. Showing published timetable schedule.
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5 text-xs font-sans">
                <div className="flex items-center gap-1.5 text-[#FFF8EE]/80">
                  <Clock className="w-3.5 h-3.5 text-[#F4A100]" />
                  <span>
                    {nextDeparture
                      ? `Next: ${formatTimeDisplay(nextDeparture.departureTime)}`
                      : timetable?.firstBusTime
                        ? `Operating: ${formatTimeDisplay(timetable.firstBusTime)}`
                        : 'Scheduled Route'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setTimetableOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F4A100]/20 hover:bg-[#F4A100]/30 text-[#F4A100] text-[11px] font-sans font-semibold border border-[#F4A100]/40 transition-all active:scale-95 shrink-0"
                >
                  <Calendar className="w-3 h-3" />
                  <span>View Schedule</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs font-sans">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[#FFF8EE]/90">Live GPS tracking active</span>
              </div>

              <button
                type="button"
                onClick={() => setTimetableOpen(true)}
                className="flex items-center gap-1 text-[11px] font-sans font-medium text-[#FFF8EE]/60 hover:text-[#F4A100] transition-colors"
              >
                <Calendar className="w-3 h-3" />
                <span>Timetable</span>
              </button>
            </div>
          )}
        </div>

        {/* Direction selector if multiple directions exist */}
        {directions.length > 1 && (
          <div className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.02] border-b border-white/5 overflow-x-auto no-scrollbar">
            {directions.map((dir, idx) => (
              <button
                key={`${dir.directionId}-${dir.tripHeadsign}`}
                type="button"
                onClick={() => setActiveDirectionIndex(idx)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans font-medium transition-all ${
                  activeDirectionIndex === idx
                    ? 'bg-[#1F7A6C] text-[#FFF8EE] shadow-sm'
                    : 'bg-white/5 text-[#FFF8EE]/60 hover:bg-white/10'
                }`}
              >
                <Navigation className="w-3 h-3" />
                <span className="truncate max-w-[140px]">{dir.tripHeadsign || `Direction ${dir.directionId}`}</span>
              </button>
            ))}
          </div>
        )}

        {/* Horizontal sequence of stops along route */}
        {routeData?.stops && routeData.stops.length > 0 && (
          <div className="p-3 bg-black/20">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#FFF8EE]/40 mb-1.5 px-1">
              Route Stops (Tap stop to view arrivals)
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {routeData.stops.map((stop, i) => (
                <button
                  key={stop.stopId}
                  type="button"
                  onClick={() => onSelectStop(stop.stopId)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-[#1F7A6C]/30 hover:border-[#1F7A6C]/50 border border-white/10 text-left transition-all shrink-0 active:scale-95 group"
                  style={{ maxWidth: 160 }}
                >
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-white/10 text-[10px] font-mono text-[#F4A100] shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-xs font-sans text-[#FFF8EE] truncate group-hover:text-[#F4A100]">
                    {stop.stopName}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Timetable Modal Dialog */}
      {routeData && (
        <RouteTimetableModal
          isOpen={timetableOpen}
          onClose={() => setTimetableOpen(false)}
          routeData={routeData}
        />
      )}
    </>
  );
}

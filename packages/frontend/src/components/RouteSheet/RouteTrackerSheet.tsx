import { useState } from 'react';
import { X, Navigation, Radio, Star, Calendar, Clock, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react';
import type { RouteDetailsResponse } from '@basbuddy/shared';
import { useFavorites } from '../../hooks/useFavorites.ts';
import { RouteTimetableModal } from './RouteTimetableModal.tsx';
import { getServiceBadge } from '../../utils/serviceBadges.ts';

interface RouteTrackerSheetProps {
  routeData: RouteDetailsResponse | null;
  loading: boolean;
  onClose: () => void;
  onSelectStop: (stopId: string) => void;
  selectedStopId?: string | null;
}

export function RouteTrackerSheet({
  routeData,
  loading: _loading,
  onClose,
  onSelectStop,
  selectedStopId,
}: RouteTrackerSheetProps) {
  const [activeDirectionIndex, setActiveDirectionIndex] = useState(0);
  const [timetableOpen, setTimetableOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const { favorites, addFavorite, removeFavorite } = useFavorites();

  const vehiclesCount = routeData?.vehicles?.length ?? 0;
  const directions = routeData?.directions ?? [];
  const timetable = routeData?.timetable;
  const serviceBadge = getServiceBadge(routeData?.routeShortName);

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

  const activeDirection = directions[activeDirectionIndex] ?? directions[0];
  const activeStops = activeDirection?.stops && activeDirection.stops.length > 0
    ? activeDirection.stops
    : (routeData?.stops ?? []);

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

  if (isMinimized) {
    return (
      <>
        <aside
          aria-label="Route inspector"
          data-testid="route-inspector"
          className="absolute top-20 left-4 md:left-6 z-30 flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#182337]/95 border border-white/15 shadow-2xl backdrop-blur-xl transition-all animate-in fade-in"
        >
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            aria-label="Expand route details"
            className="flex items-center gap-2 text-left active:scale-95 transition-transform"
          >
            <div className="flex items-center justify-center px-2 py-0.5 rounded-lg bg-[#F4A100] text-[#101B2D] font-display text-sm font-bold shadow-sm select-none shrink-0">
              {routeData?.routeShortName || '...'}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className={`flex items-center gap-1 ${vehiclesCount > 0 ? 'text-[#E94B8C]' : 'text-amber-400/80'}`}>
                <Radio className={`w-3 h-3 ${vehiclesCount > 0 ? 'animate-pulse' : ''}`} />
                <span>{vehiclesCount} live</span>
              </span>
              <span className="text-[#FFF8EE]/40">•</span>
              <span className="text-[#FFF8EE]/70 font-sans flex items-center gap-0.5 text-[11px]">
                <span>Details</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#F4A100]" />
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close route inspector"
            className="flex items-center justify-center w-6 h-6 rounded-full bg-white/5 hover:bg-white/15 text-[#FFF8EE]/70 hover:text-[#FFF8EE] active:scale-90 transition-all ml-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </aside>

        {routeData && (
          <RouteTimetableModal
            isOpen={timetableOpen}
            onClose={() => setTimetableOpen(false)}
            routeData={routeData}
            onSelectStop={onSelectStop}
            selectedStopId={selectedStopId}
            initialDirectionIndex={activeDirectionIndex}
          />
        )}
      </>
    );
  }

  return (
    <>
      <aside
        aria-label="Route inspector"
        data-testid="route-inspector"
        className="absolute top-20 left-4 right-4 z-30 max-w-md mx-auto md:left-6 md:right-auto md:top-20 md:w-96 md:max-w-none md:mx-0 max-h-[calc(100vh-13rem)] md:max-h-[calc(100vh-12rem)] flex flex-col rounded-2xl bg-[#182337]/95 border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden transition-all"
      >
        {/* Route Header */}
        <div className="flex items-center justify-between gap-3 p-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center min-w-[44px] h-9 px-2.5 rounded-xl bg-[#F4A100] text-[#101B2D] font-display text-lg font-bold shadow-md shrink-0 select-none">
              {routeData?.routeShortName || '...'}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-sans font-bold text-[#FFF8EE] truncate">
                  {routeData?.routeLongName || 'Loading route...'}
                </h2>
                {routeData && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded border shrink-0 ${serviceBadge.badgeClass}`}
                  >
                    {serviceBadge.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs font-mono text-[#FFF8EE]/60">
                <span className={`flex items-center gap-1 ${vehiclesCount > 0 ? 'text-[#E94B8C]' : 'text-amber-400/80'}`}>
                  <Radio className={`w-3 h-3 ${vehiclesCount > 0 ? 'animate-pulse' : ''}`} />
                  {vehiclesCount} {vehiclesCount === 1 ? 'bus live' : 'buses live'}
                </span>
                {activeStops && (
                  <>
                    <span>•</span>
                    <span>{activeStops.length} stops</span>
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
              onClick={() => setIsMinimized(true)}
              aria-label="Minimize route inspector"
              title="Minimize route card"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-[#FFF8EE]/80 hover:text-[#FFF8EE] active:scale-95 transition-all"
            >
              <ChevronUp className="w-4 h-4" />
            </button>

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
        <div className="px-4 py-2.5 bg-[#101B2D]/70 border-b border-white/5 shrink-0">
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
                <span>Timetable & ETAs</span>
              </button>
            </div>
          )}
        </div>

        {/* Direction selector if multiple directions exist */}
        {directions.length > 1 && (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.02] border-b border-white/5 overflow-x-auto no-scrollbar shrink-0">
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
                <span className="truncate max-w-[140px]">➔ Towards {dir.tripHeadsign || `Direction ${dir.directionId}`}</span>
              </button>
            ))}
          </div>
        )}

        {/* Sequence of stops along route: Horizontal on mobile, Vertical list on desktop/web view */}
        {activeStops && activeStops.length > 0 && (
          <div className="p-3 bg-black/20 md:p-3.5 flex flex-col min-h-0 flex-1 overflow-hidden">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#FFF8EE]/40 mb-1.5 px-1 flex items-center justify-between shrink-0">
              <span className="flex items-center gap-1.5">
                <span>Route Stops</span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[9px] font-medium text-[#F4A100]">
                  {activeStops.length}
                </span>
              </span>
              <span className="text-[9px] text-[#FFF8EE]/30 hidden md:inline font-sans normal-case">
                Click stop to view arrivals
              </span>
            </div>

            {/* Mobile: horizontal scroll strip | Web/Desktop (md:): vertical scrollable list */}
            <div className="flex flex-row md:flex-col items-center md:items-stretch gap-1.5 md:gap-1.5 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto no-scrollbar md:basbuddy-scroll pb-1 md:pb-0 md:pr-1 min-h-0 flex-1">
              {activeStops.map((stop, i) => {
                const isSelected = selectedStopId === stop.stopId;
                const hasEta = stop.etaSeconds !== undefined && stop.etaSeconds !== null;
                return (
                  <button
                    key={stop.stopId}
                    type="button"
                    onClick={() => onSelectStop(stop.stopId)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 md:py-2 rounded-xl text-left transition-all shrink-0 max-w-[160px] md:max-w-none md:w-full active:scale-[0.98] group ${
                      isSelected
                        ? 'bg-[#1F7A6C]/40 border-[#1F7A6C] ring-1 ring-[#1F7A6C]/60 text-[#FFF8EE]'
                        : 'bg-white/5 hover:bg-[#1F7A6C]/30 hover:border-[#1F7A6C]/50 border border-white/10 text-[#FFF8EE]'
                    }`}
                  >
                    <span
                      className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-mono font-medium shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-[#F4A100] text-[#101B2D] font-bold'
                          : 'bg-white/10 text-[#F4A100] group-hover:bg-[#F4A100] group-hover:text-[#101B2D]'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-sans text-[#FFF8EE] truncate group-hover:text-[#F4A100] transition-colors">
                        {stop.stopName}
                      </div>
                      <div className="text-[10px] font-mono text-[#FFF8EE]/40 truncate hidden md:block">
                        {stop.stopId}
                      </div>
                    </div>
                    {hasEta && (
                      <span className="hidden md:inline-flex text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        {Math.round(stop.etaSeconds! / 60)}m
                      </span>
                    )}
                  </button>
                );
              })}
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
          onSelectStop={onSelectStop}
          selectedStopId={selectedStopId}
          initialDirectionIndex={activeDirectionIndex}
        />
      )}
    </>
  );
}

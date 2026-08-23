import { useState, useEffect, useMemo } from 'react';
import { X, Clock, Calendar, Info, Radio, Sparkles, ArrowRight } from 'lucide-react';
import type { RouteDetailsResponse, RouteStopItem } from '@basbuddy/shared';
import { RouteEtaCalculator } from './RouteEtaCalculator.tsx';

interface RouteTimetableModalProps {
  isOpen: boolean;
  onClose: () => void;
  routeData: RouteDetailsResponse;
  onSelectStop?: (stopId: string) => void;
  selectedStopId?: string | null;
}

type TimetableTab = 'timeline' | 'schedule' | 'calculator';

export function RouteTimetableModal({
  isOpen,
  onClose,
  routeData,
  onSelectStop,
  selectedStopId,
}: RouteTimetableModalProps) {
  const [activeTab, setActiveTab] = useState<TimetableTab>('timeline');
  const [activeDirectionIndex, setActiveDirectionIndex] = useState<number>(0);

  const directions = routeData.directions ?? [];
  const activeDirection = directions[activeDirectionIndex] ?? directions[0];
  const activeDirectionId = activeDirection?.directionId ?? 0;

  // Active stops for this direction (fall back to routeData.stops)
  const activeStops: RouteStopItem[] = useMemo(() => {
    if (activeDirection?.stops && activeDirection.stops.length > 0) {
      return activeDirection.stops;
    }
    return routeData.stops ?? [];
  }, [activeDirection, routeData.stops]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const timetable = routeData.timetable;
  const allDepartures = timetable?.allDepartures ?? [];
  const vehicles = routeData.vehicles ?? [];

  // Filter departures for the active direction
  const dirDepartures = allDepartures.filter(
    (d) => directions.length <= 1 || d.directionId === activeDirectionId,
  );

  // Group departures into Morning (<12:00), Afternoon (12:00 - 17:59), Evening/Night (>= 18:00)
  const morning = dirDepartures.filter((d) => {
    const hour = parseInt(d.departureTime.split(':')[0] ?? '0', 10);
    return hour < 12;
  });
  const afternoon = dirDepartures.filter((d) => {
    const hour = parseInt(d.departureTime.split(':')[0] ?? '0', 10);
    return hour >= 12 && hour < 18;
  });
  const evening = dirDepartures.filter((d) => {
    const hour = parseInt(d.departureTime.split(':')[0] ?? '0', 10);
    return hour >= 18;
  });

  const nextDepartureTripId = timetable?.nextDepartures?.[0]?.tripId;

  const formatTimeDisplay = (timeStr?: string | null) => {
    if (!timeStr) return 'N/A';
    const parts = timeStr.split(':');
    let h = parseInt(parts[0] ?? '0', 10);
    const m = parts[1] ?? '00';
    const nextDay = h >= 24;
    if (nextDay) h -= 24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 === 0 ? 12 : h % 12;
    return `${formattedH}:${m} ${ampm}${nextDay ? ' (+1)' : ''}`;
  };

  const formatEtaMinutes = (seconds?: number | null) => {
    if (seconds === undefined || seconds === null) return null;
    const mins = Math.round(seconds / 60);
    if (mins <= 1) return 'Arriving now';
    return `${mins} min`;
  };

  // Find live vehicle positions along the active stops
  const liveVehicles = vehicles.filter((v) => v.freshness === 'live' || v.freshness === 'stale');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="timetable-pane-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200 md:bg-transparent md:backdrop-blur-none md:p-0 md:pointer-events-none md:inset-auto md:top-20 md:right-6 md:w-[420px] md:max-h-[calc(100vh-12rem)] md:block"
    >
      <div className="relative w-full max-w-lg max-h-[85vh] md:max-h-[calc(100vh-12rem)] md:w-[420px] flex flex-col rounded-2xl bg-[#182337]/95 border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden text-[#FFF8EE] md:pointer-events-auto transition-all animate-in md:slide-in-from-right-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-3.5 border-b border-white/10 bg-[#101B2D]/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center min-w-[44px] h-9 px-2.5 rounded-xl bg-[#F4A100] text-[#101B2D] font-display text-lg font-bold shadow-md shrink-0 select-none">
              {routeData.routeShortName}
            </div>
            <div className="min-w-0">
              <h2 id="timetable-pane-title" className="text-sm font-sans font-bold text-[#FFF8EE] leading-tight truncate">
                Route Timetable & Live ETAs
              </h2>
              <p className="text-xs font-mono text-[#FFF8EE]/50 truncate max-w-[230px]">
                {routeData.routeLongName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close timetable"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-[#FFF8EE]/80 hover:text-[#FFF8EE] active:scale-95 transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Direction Selector — Clarified with explicit "Towards" headsign labels */}
        {directions.length > 1 && (
          <div className="p-2.5 border-b border-white/5 bg-[#101B2D]/60 shrink-0 space-y-1.5">
            <div className="text-[10px] font-mono text-[#FFF8EE]/50 uppercase tracking-wider px-1">
              Select Direction
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {directions.map((dir, idx) => {
                const isSelected = activeDirectionIndex === idx;
                const stopCount = dir.stops?.length || activeStops.length;
                return (
                  <button
                    key={`${dir.directionId}-${dir.tripHeadsign}`}
                    type="button"
                    onClick={() => setActiveDirectionIndex(idx)}
                    className={`flex flex-col text-left p-2 rounded-xl border transition-all active:scale-[0.98] ${
                      isSelected
                        ? 'bg-[#1F7A6C]/30 border-[#1F7A6C] ring-1 ring-[#1F7A6C]/60 text-[#FFF8EE]'
                        : 'bg-white/5 border-white/5 text-[#FFF8EE]/60 hover:bg-white/10 hover:text-[#FFF8EE]'
                    }`}
                  >
                    <div className="flex items-center gap-1 text-[11px] font-sans font-bold truncate">
                      <ArrowRight className={`w-3 h-3 shrink-0 ${isSelected ? 'text-[#F4A100]' : 'text-[#FFF8EE]/40'}`} />
                      <span className="truncate">{dir.tripHeadsign || `Direction ${dir.directionId}`}</span>
                    </div>
                    <div className="text-[10px] font-mono text-[#FFF8EE]/40 mt-0.5 pl-4">
                      {stopCount} stops • Dir {dir.directionId === 0 ? 'Outbound' : 'Inbound'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* View Mode Navigation Tabs */}
        <div className="flex items-center gap-1 p-1.5 bg-[#101B2D]/80 border-b border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-sans font-semibold transition-all ${
              activeTab === 'timeline'
                ? 'bg-[#F4A100] text-[#101B2D] shadow-md'
                : 'text-[#FFF8EE]/70 hover:bg-white/5 hover:text-[#FFF8EE]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Stop Timeline & ETAs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-sans font-semibold transition-all ${
              activeTab === 'schedule'
                ? 'bg-[#F4A100] text-[#101B2D] shadow-md'
                : 'text-[#FFF8EE]/70 hover:bg-white/5 hover:text-[#FFF8EE]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Daily Schedule</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('calculator')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-sans font-semibold transition-all ${
              activeTab === 'calculator'
                ? 'bg-[#F4A100] text-[#101B2D] shadow-md'
                : 'text-[#FFF8EE]/70 hover:bg-white/5 hover:text-[#FFF8EE]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Trip Calc</span>
          </button>
        </div>

        {/* Tab 1: Stop Timeline & Live ETAs (Default View) */}
        {activeTab === 'timeline' && (
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 basbuddy-scroll min-h-0">
            {/* Live status banner */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs font-sans">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${liveVehicles.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400/80'}`} />
                <span className="text-[#FFF8EE]/90">
                  {liveVehicles.length > 0
                    ? `${liveVehicles.length} live ${liveVehicles.length === 1 ? 'bus' : 'buses'} tracking on route`
                    : 'Showing published schedule times'}
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#FFF8EE]/40">
                {activeStops.length} stops total
              </span>
            </div>

            {/* Stop Ladder Timeline */}
            <div className="relative pl-3 pr-1 py-1 space-y-0">
              {/* Vertical connecting line */}
              <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-[#1F7A6C] via-white/20 to-[#FF5A47]" />

              {activeStops.map((stop, index) => {
                const isSelected = selectedStopId === stop.stopId;
                const isFirst = index === 0;
                const isLast = index === activeStops.length - 1;

                // Check if any live vehicle is at or nearest to this stop
                const matchingVehicle = liveVehicles.find(
                  (v) => v.nearestStopId === stop.stopId,
                );

                const hasEta = stop.etaSeconds !== undefined && stop.etaSeconds !== null;
                const isPassed = !hasEta && liveVehicles.length > 0 && stop.stopSequence < (liveVehicles[0]?.nearestStopId ? activeStops.find(s => s.stopId === liveVehicles[0]?.nearestStopId)?.stopSequence ?? 0 : 0);

                return (
                  <div key={stop.stopId} className="relative group">
                    {/* Live bus badge if bus is approaching this stop */}
                    {matchingVehicle && (
                      <div className="my-2 ml-5 p-2 rounded-xl bg-[#E94B8C]/20 border border-[#E94B8C]/60 text-white shadow-lg backdrop-blur-md animate-in slide-in-from-left-2 duration-300">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-sans font-bold text-[#FFF8EE]">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#E94B8C] text-white">
                              <Radio className="w-3 h-3 animate-pulse" />
                            </span>
                            <span>LIVE BUS #1</span>
                          </div>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-emerald-300 border border-emerald-500/30">
                            Approaching Stop #{index + 1}
                          </span>
                        </div>
                      </div>
                    )}

                    <div
                      className={`flex items-start gap-3 p-2 rounded-xl transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#1F7A6C]/30 border border-[#1F7A6C]/60 text-[#FFF8EE]'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                      onClick={() => onSelectStop && onSelectStop(stop.stopId)}
                    >
                      {/* Timeline Node Point */}
                      <div className="relative flex items-center justify-center shrink-0 z-10 mt-0.5">
                        <span
                          className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-mono font-bold transition-all ${
                            isFirst
                              ? 'bg-[#1F7A6C] text-[#FFF8EE] ring-2 ring-[#1F7A6C]/40'
                              : isLast
                                ? 'bg-[#FF5A47] text-[#FFF8EE] ring-2 ring-[#FF5A47]/40'
                                : matchingVehicle
                                  ? 'bg-[#E94B8C] text-white ring-4 ring-[#E94B8C]/40 animate-pulse'
                                  : isPassed
                                    ? 'bg-white/10 text-[#FFF8EE]/40 border border-white/10'
                                    : 'bg-[#182337] border-2 border-[#F4A100] text-[#F4A100]'
                          }`}
                        >
                          {index + 1}
                        </span>
                      </div>

                      {/* Stop Info & ETAs */}
                      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-sans font-medium truncate ${isPassed ? 'text-[#FFF8EE]/50 line-through' : 'text-[#FFF8EE]'}`}>
                              {stop.stopName}
                            </span>
                            {isFirst && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#1F7A6C]/40 text-[#FFF8EE] border border-[#1F7A6C]/60 shrink-0">
                                Origin
                              </span>
                            )}
                            {isLast && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#FF5A47]/40 text-[#FFF8EE] border border-[#FF5A47]/60 shrink-0">
                                Terminus
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-[#FFF8EE]/40 truncate">
                            {stop.stopId}
                            {stop.scheduledTime && ` • Departs ${formatTimeDisplay(stop.scheduledTime)}`}
                          </div>
                        </div>

                        {/* ETA Badge */}
                        <div className="shrink-0 text-right">
                          {hasEta ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              {formatEtaMinutes(stop.etaSeconds)}
                            </span>
                          ) : isPassed ? (
                            <span className="text-[10px] font-mono text-[#FFF8EE]/30">
                              Departed
                            </span>
                          ) : stop.scheduledTime ? (
                            <span className="text-xs font-mono text-[#F4A100] font-medium">
                              {formatTimeDisplay(stop.scheduledTime)}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-[#FFF8EE]/40">
                              Scheduled
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Full Daily Schedule Grid */}
        {activeTab === 'schedule' && (
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4 basbuddy-scroll min-h-0">
            {/* Operating hours & summary ribbon */}
            <div className="grid grid-cols-2 gap-2 text-xs font-sans shrink-0">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/5">
                <Clock className="w-4 h-4 text-[#F4A100] shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-mono text-[#FFF8EE]/40 uppercase truncate">First Bus</div>
                  <div className="font-bold text-[#FFF8EE] truncate">
                    {timetable?.firstBusTime ? formatTimeDisplay(timetable.firstBusTime) : 'N/A'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/5">
                <Calendar className="w-4 h-4 text-[#1F7A6C] shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-mono text-[#FFF8EE]/40 uppercase truncate">Last Bus</div>
                  <div className="font-bold text-[#FFF8EE] truncate">
                    {timetable?.lastBusTime ? formatTimeDisplay(timetable.lastBusTime) : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Departures Grid */}
            {dirDepartures.length === 0 ? (
              <div className="text-center py-8 text-sm font-sans text-[#FFF8EE]/50">
                No scheduled trips found for this direction today.
              </div>
            ) : (
              <>
                {morning.length > 0 && (
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-wider text-[#F4A100] mb-2 flex items-center gap-1.5">
                      <span>🌅 Morning</span>
                      <span className="text-[10px] text-[#FFF8EE]/40">({morning.length} trips)</span>
                    </h3>
                    <div className="grid grid-cols-3 gap-1.5">
                      {morning.map((d) => {
                        const isNext = d.tripId === nextDepartureTripId;
                        return (
                          <div
                            key={d.tripId}
                            className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                              isNext
                                ? 'bg-[#F4A100]/20 border-[#F4A100] ring-2 ring-[#F4A100]/40 shadow-md'
                                : 'bg-white/5 border-white/10'
                            }`}
                          >
                            <span className={`text-xs font-mono font-bold ${isNext ? 'text-[#F4A100]' : 'text-[#FFF8EE]'}`}>
                              {formatTimeDisplay(d.departureTime)}
                            </span>
                            {isNext && (
                              <span className="text-[9px] font-sans font-bold text-[#F4A100] uppercase tracking-tight mt-0.5">
                                Next Bus
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {afternoon.length > 0 && (
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-wider text-[#F4A100] mb-2 flex items-center gap-1.5">
                      <span>☀️ Afternoon</span>
                      <span className="text-[10px] text-[#FFF8EE]/40">({afternoon.length} trips)</span>
                    </h3>
                    <div className="grid grid-cols-3 gap-1.5">
                      {afternoon.map((d) => {
                        const isNext = d.tripId === nextDepartureTripId;
                        return (
                          <div
                            key={d.tripId}
                            className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                              isNext
                                ? 'bg-[#F4A100]/20 border-[#F4A100] ring-2 ring-[#F4A100]/40 shadow-md'
                                : 'bg-white/5 border-white/10'
                            }`}
                          >
                            <span className={`text-xs font-mono font-bold ${isNext ? 'text-[#F4A100]' : 'text-[#FFF8EE]'}`}>
                              {formatTimeDisplay(d.departureTime)}
                            </span>
                            {isNext && (
                              <span className="text-[9px] font-sans font-bold text-[#F4A100] uppercase tracking-tight mt-0.5">
                                Next Bus
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {evening.length > 0 && (
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-wider text-[#F4A100] mb-2 flex items-center gap-1.5">
                      <span>🌙 Evening & Night</span>
                      <span className="text-[10px] text-[#FFF8EE]/40">({evening.length} trips)</span>
                    </h3>
                    <div className="grid grid-cols-3 gap-1.5">
                      {evening.map((d) => {
                        const isNext = d.tripId === nextDepartureTripId;
                        return (
                          <div
                            key={d.tripId}
                            className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                              isNext
                                ? 'bg-[#F4A100]/20 border-[#F4A100] ring-2 ring-[#F4A100]/40 shadow-md'
                                : 'bg-white/5 border-white/10'
                            }`}
                          >
                            <span className={`text-xs font-mono font-bold ${isNext ? 'text-[#F4A100]' : 'text-[#FFF8EE]'}`}>
                              {formatTimeDisplay(d.departureTime)}
                            </span>
                            {isNext && (
                              <span className="text-[9px] font-sans font-bold text-[#F4A100] uppercase tracking-tight mt-0.5">
                                Next Bus
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 3: Interactive Origin-to-Destination Trip Calculator */}
        {activeTab === 'calculator' && (
          <div className="flex-1 overflow-y-auto p-3.5 basbuddy-scroll min-h-0">
            <RouteEtaCalculator
              stops={activeStops}
              vehicles={vehicles}
              onSelectStop={onSelectStop}
              initialOriginStopId={selectedStopId}
            />
          </div>
        )}

        {/* Footer info note */}
        <div className="p-3 border-t border-white/5 bg-[#101B2D]/80 text-xs font-sans text-[#FFF8EE]/50 flex items-start gap-2 shrink-0">
          <Info className="w-3.5 h-3.5 text-[#F4A100] shrink-0 mt-0.5" />
          <p className="text-[11px] leading-tight">
            Arrival estimates are calculated from live GPS feeds & published schedules via <span className="text-[#FFF8EE] font-semibold">data.gov.my</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

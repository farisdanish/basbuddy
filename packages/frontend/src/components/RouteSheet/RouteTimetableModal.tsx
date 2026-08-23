import { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Info, Radio, Sparkles, ArrowRight, Bus } from 'lucide-react';
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

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':');
  const h = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  const s = parseInt(parts[2] ?? '0', 10);
  return h * 3600 + m * 60 + s;
}

function secondsToTimeString(totalSec: number): string {
  let h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const nextDay = h >= 24;
  if (nextDay) h -= 24;
  const hh = String(h % 12 === 0 ? 12 : h % 12);
  const mm = String(m).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${hh}:${mm} ${ampm}${nextDay ? ' (+1)' : ''}`;
}

function getKLSecondsSinceMidnight(): number {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const s = parseInt(parts.find((p) => p.type === 'second')?.value ?? '0', 10);
  return h * 3600 + m * 60 + s;
}

function findClosestDepartureTripId(departures: Array<{ tripId: string; departureTime: string }>): string {
  if (departures.length === 0) return '';
  const nowSec = getKLSecondsSinceMidnight();

  // First check if there is an upcoming departure today (departure time >= current time - 2 mins grace)
  const upcoming = departures.filter((d) => parseTimeToSeconds(d.departureTime) >= nowSec - 120);
  if (upcoming.length > 0) {
    return upcoming[0]!.tripId;
  }

  // If all departures today have passed (e.g. late night), find closest trip by absolute time difference
  let closest = departures[0]!;
  let minDiff = Infinity;
  for (const d of departures) {
    const diff = Math.abs(parseTimeToSeconds(d.departureTime) - nowSec);
    if (diff < minDiff) {
      minDiff = diff;
      closest = d;
    }
  }
  return closest.tripId;
}

export function RouteTimetableModal({
  isOpen,
  onClose,
  routeData,
  onSelectStop,
  selectedStopId,
}: RouteTimetableModalProps) {
  const [activeTab, setActiveTab] = useState<TimetableTab>('timeline');
  const [activeDirectionIndex, setActiveDirectionIndex] = useState<number>(0);
  const [selectedTripId, setSelectedTripId] = useState<string>('');

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

  const timetable = routeData.timetable;
  const allDepartures = timetable?.allDepartures ?? [];
  const vehicles = routeData.vehicles ?? [];

  // Filter departures for the active direction
  const dirDepartures = useMemo(() => {
    return allDepartures.filter(
      (d) => directions.length <= 1 || d.directionId === activeDirectionId,
    );
  }, [allDepartures, directions.length, activeDirectionId]);

  const nextDepartureTripId = useMemo(() => {
    return findClosestDepartureTripId(dirDepartures);
  }, [dirDepartures]);

  // Default to the trip closest to current time
  useEffect(() => {
    if (dirDepartures.length > 0) {
      const closestTripId = findClosestDepartureTripId(dirDepartures);
      setSelectedTripId(closestTripId);
    }
  }, [dirDepartures, activeDirectionIndex]);

  const activeTrip = dirDepartures.find((d) => d.tripId === selectedTripId) || dirDepartures[0];
  const originDepartureTime = activeTrip?.departureTime || timetable?.firstBusTime || '06:00:00';

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

  // Detect if GTFS raw schedule contains flat/identical timestamps across all stops
  const isFlatSchedule = useMemo(() => {
    if (activeStops.length <= 1) return false;
    const firstTime = activeStops[0]?.scheduledTime;
    if (!firstTime) return true;
    const identicalCount = activeStops.filter((s) => s.scheduledTime === firstTime).length;
    return identicalCount > activeStops.length * 0.6; // >60% identical timestamps means agency exported flat dispatch times
  }, [activeStops]);

  // Compute progressive arrival times for all stops along the route
  const processedStops = useMemo(() => {
    if (activeStops.length === 0) return [];
    const tripStartSec = parseTimeToSeconds(originDepartureTime);

    let cumDistanceMeters = 0;
    return activeStops.map((stop, index) => {
      if (index > 0) {
        const prev = activeStops[index - 1]!;
        cumDistanceMeters += haversineMeters(prev.lat, prev.lon, stop.lat, stop.lon);
      }

      if (index === 0) {
        return {
          ...stop,
          displayTime: formatTimeDisplay(originDepartureTime),
          isEstimated: false,
          isOrigin: true,
          cumDistanceKm: 0,
        };
      }

      if (isFlatSchedule) {
        // Interpolate travel time at ~22 km/h (6.11 m/s) + 25s dwell time per stop
        const transitTimeSec = Math.round(cumDistanceMeters / 6.11) + index * 25;
        const arrivalSec = tripStartSec + transitTimeSec;
        return {
          ...stop,
          displayTime: secondsToTimeString(arrivalSec),
          isEstimated: true,
          isOrigin: false,
          cumDistanceKm: Math.round((cumDistanceMeters / 1000) * 10) / 10,
        };
      }

      // If GTFS has valid distinct times, compute offset from origin departure
      if (stop.scheduledTime) {
        const sampleStartSec = parseTimeToSeconds(activeStops[0]?.scheduledTime || '06:00:00');
        const stopSampleSec = parseTimeToSeconds(stop.scheduledTime);
        const offsetFromStart = Math.max(0, stopSampleSec - sampleStartSec);
        const arrivalSec = tripStartSec + offsetFromStart;
        return {
          ...stop,
          displayTime: secondsToTimeString(arrivalSec),
          isEstimated: false,
          isOrigin: false,
          cumDistanceKm: Math.round((cumDistanceMeters / 1000) * 10) / 10,
        };
      }

      // Fallback
      const transitTimeSec = Math.round(cumDistanceMeters / 6.11) + index * 25;
      const arrivalSec = tripStartSec + transitTimeSec;
      return {
        ...stop,
        displayTime: secondsToTimeString(arrivalSec),
        isEstimated: true,
        isOrigin: false,
        cumDistanceKm: Math.round((cumDistanceMeters / 1000) * 10) / 10,
      };
    });
  }, [activeStops, originDepartureTime, isFlatSchedule]);

  if (!isOpen) return null;

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
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200 md:bg-transparent md:backdrop-blur-none md:p-0 md:pointer-events-none md:inset-auto md:top-20 md:right-6 md:w-[440px] md:max-h-[calc(100vh-10rem)] md:block"
    >
      <div className="relative w-full max-w-lg max-h-[85vh] md:max-h-[calc(100vh-10rem)] md:w-[440px] flex flex-col rounded-3xl bg-[#182337]/95 border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden text-[#FFF8EE] md:pointer-events-auto transition-all animate-in md:slide-in-from-right-4 duration-200">
        {/* Header section */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#101B2D]/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center px-2.5 h-8 rounded-lg bg-[#F4A100] text-[#101B2D] font-display font-bold text-sm shadow-sm select-none shrink-0">
              {routeData.routeShortName}
            </div>
            <div className="min-w-0">
              <h2 id="timetable-pane-title" className="text-sm font-sans font-bold text-[#FFF8EE] leading-tight truncate">
                Route Timetable & Live ETAs
              </h2>
              <p className="text-xs font-sans text-[#FFF8EE]/60 truncate">
                {routeData.routeLongName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close timetable"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-[#FFF8EE]/70 hover:text-[#FFF8EE] active:scale-95 transition-all shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Direction Switcher (Outbound vs Inbound) */}
        {directions.length > 1 && (
          <div className="p-2.5 bg-[#101B2D]/50 border-b border-white/5 shrink-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#FFF8EE]/40 mb-1.5 px-1">
              Select Route Direction
            </div>
            <div className="grid grid-cols-2 gap-2">
              {directions.map((dir, index) => {
                const isSelected = index === activeDirectionIndex;
                const stopCount = dir.stops?.length ?? activeStops.length;
                return (
                  <button
                    key={`${dir.directionId}-${dir.tripHeadsign}`}
                    type="button"
                    onClick={() => setActiveDirectionIndex(index)}
                    className={`p-2 rounded-xl border text-left transition-all active:scale-[0.99] ${
                      isSelected
                        ? 'bg-[#1F7A6C]/30 border-[#1F7A6C] ring-1 ring-[#1F7A6C]/60 text-[#FFF8EE]'
                        : 'bg-white/5 border-white/5 text-[#FFF8EE]/60 hover:bg-white/10 hover:text-[#FFF8EE]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-bold">
                        <ArrowRight className={`w-3 h-3 ${isSelected ? 'text-[#F4A100]' : 'text-white/40'}`} />
                        {dir.tripHeadsign || `Dir ${dir.directionId}`}
                    </div>
                    <div className="text-[10px] opacity-60 ml-4.5">{stopCount} stops</div>
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

        {/* Tab 1: Stop Timeline & Live ETAs */}
        {activeTab === 'timeline' && (
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 basbuddy-scroll min-h-0">
            {/* Live status banner */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs font-sans">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${liveVehicles.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400/80'}`} />
                <span className="text-[#FFF8EE]/90">
                  {liveVehicles.length > 0
                    ? `${liveVehicles.length} live ${liveVehicles.length === 1 ? 'bus' : 'buses'} tracking`
                    : 'Showing schedule times'}
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#FFF8EE]/40">
                {activeStops.length} stops total
              </span>
            </div>

            {/* Trip Selector Strip */}
            {dirDepartures.length > 0 && (
              <div className="p-2.5 rounded-xl bg-[#101B2D]/70 border border-white/5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Bus className="w-4 h-4 text-[#F4A100] shrink-0" />
                  <span className="text-xs font-sans font-medium text-[#FFF8EE] shrink-0">Trip Run:</span>
                  <select
                    value={selectedTripId}
                    onChange={(e) => setSelectedTripId(e.target.value)}
                    aria-label="Select scheduled trip departure"
                    className="bg-[#182337] border border-white/10 text-xs font-mono font-bold text-[#F4A100] py-1 px-2 rounded-lg focus:outline-none focus:border-[#F4A100] truncate"
                  >
                    {dirDepartures.map((d) => {
                      const isNext = d.tripId === nextDepartureTripId;
                      return (
                        <option key={d.tripId} value={d.tripId}>
                          {formatTimeDisplay(d.departureTime)} {isNext ? '(Next Bus)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="text-[10px] font-mono text-[#FFF8EE]/50 shrink-0">
                  {dirDepartures.length} trips today
                </div>
              </div>
            )}

            {/* Flat Schedule Info Disclaimer */}
            {isFlatSchedule && (
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] font-sans text-amber-200/90 leading-tight">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span>
                    Operator published origin departure at <strong>{formatTimeDisplay(originDepartureTime)}</strong>. Intermediate arrival times (~) are progressive estimates based on route distance and traffic speed.
                  </span>
                </div>
              </div>
            )}

            {/* Stop Ladder Timeline */}
            <div className="relative pl-3 pr-1 py-1 space-y-0">
              {/* Vertical connecting line */}
              <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-[#1F7A6C] via-white/20 to-[#FF5A47]" />

              {processedStops.map((stop, index) => {
                const isSelected = selectedStopId === stop.stopId;
                const isFirst = index === 0;
                const isLast = index === processedStops.length - 1;

                // Check if any live vehicle is at or nearest to this stop
                const matchingVehicle = liveVehicles.find(
                  (v) => v.nearestStopId === stop.stopId,
                );

                const hasEta = stop.etaSeconds !== undefined && stop.etaSeconds !== null;
                const isPassed = !hasEta && liveVehicles.length > 0 && stop.stopSequence < (liveVehicles[0]?.nearestStopId ? activeStops.find(s => s.stopId === liveVehicles[0]?.nearestStopId)?.stopSequence ?? 0 : 0);

                return (
                  <div key={stop.stopId} className="relative group">
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
                          </div>
                          <div className="text-[10px] font-mono text-[#FFF8EE]/40 truncate">
                            {stop.stopId}
                            {stop.cumDistanceKm > 0 && ` • ${stop.cumDistanceKm} km`}
                            {isFirst && ` • Departs ${stop.displayTime}`}
                            {!isFirst && ` • ${stop.isEstimated ? 'Est' : 'Sched'} ${stop.displayTime}`}
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
                          ) : (
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-mono text-[#F4A100] font-medium">
                                {stop.displayTime}
                              </span>
                              {stop.isEstimated && (
                                <span className="text-[9px] font-sans text-[#FFF8EE]/40">
                                  Est
                                </span>
                              )}
                            </div>
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
                <div className="min-w-0">
                  <div className="text-[10px] font-mono text-[#FFF8EE]/40 uppercase truncate">First Bus</div>
                  <div className="font-bold text-[#FFF8EE] truncate">
                    {timetable?.firstBusTime ? formatTimeDisplay(timetable.firstBusTime) : '06:00 AM'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/5">
                <div className="min-w-0">
                  <div className="text-[10px] font-mono text-[#FFF8EE]/40 uppercase truncate">Last Bus</div>
                  <div className="font-bold text-[#FFF8EE] truncate">
                    {timetable?.lastBusTime ? formatTimeDisplay(timetable.lastBusTime) : '11:30 PM'}
                  </div>
                </div>
              </div>
            </div>

            {dirDepartures.length === 0 && (
              <div className="text-center py-8 px-4 rounded-2xl bg-white/[0.02] border border-white/5 my-2">
                <p className="text-sm font-sans font-medium text-[#FFF8EE]">
                  No scheduled trips found for this direction today
                </p>
                <p className="text-xs font-sans text-[#FFF8EE]/50 mt-1">
                  Service may run on headway intervals or operate under alternate calendar schedules.
                </p>
              </div>
            )}

            {morning.length > 0 && (
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-[#F4A100] mb-2">Morning</h3>
                <div className="grid grid-cols-3 gap-1.5">
                  {morning.map((d) => {
                    const isNext = d.tripId === nextDepartureTripId;
                    return (
                      <div
                        key={d.tripId}
                        onClick={() => {
                          setSelectedTripId(d.tripId);
                          setActiveTab('timeline');
                        }}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                          isNext
                            ? 'bg-[#F4A100]/20 border-[#F4A100] ring-2 ring-[#F4A100]/40 shadow-md'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <span className={`text-xs font-mono font-bold ${isNext ? 'text-[#F4A100]' : 'text-[#FFF8EE]'}`}>
                          {formatTimeDisplay(d.departureTime)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {afternoon.length > 0 && (
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-[#F4A100] mb-2">Afternoon</h3>
                <div className="grid grid-cols-3 gap-1.5">
                  {afternoon.map((d) => {
                    const isNext = d.tripId === nextDepartureTripId;
                    return (
                      <div
                        key={d.tripId}
                        onClick={() => {
                          setSelectedTripId(d.tripId);
                          setActiveTab('timeline');
                        }}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                          isNext
                            ? 'bg-[#F4A100]/20 border-[#F4A100] ring-2 ring-[#F4A100]/40 shadow-md'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <span className={`text-xs font-mono font-bold ${isNext ? 'text-[#F4A100]' : 'text-[#FFF8EE]'}`}>
                          {formatTimeDisplay(d.departureTime)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {evening.length > 0 && (
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-[#F4A100] mb-2">Evening</h3>
                <div className="grid grid-cols-3 gap-1.5">
                  {evening.map((d) => {
                    const isNext = d.tripId === nextDepartureTripId;
                    return (
                      <div
                        key={d.tripId}
                        onClick={() => {
                          setSelectedTripId(d.tripId);
                          setActiveTab('timeline');
                        }}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                          isNext
                            ? 'bg-[#F4A100]/20 border-[#F4A100] ring-2 ring-[#F4A100]/40 shadow-md'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <span className={`text-xs font-mono font-bold ${isNext ? 'text-[#F4A100]' : 'text-[#FFF8EE]'}`}>
                          {formatTimeDisplay(d.departureTime)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Trip Calculator */}
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
        <div className="p-3 border-t border-white/5 bg-[#101B2D]/80 text-[10px] font-sans text-[#FFF8EE]/40 flex items-start gap-2 shrink-0">
          <Info className="w-3 h-3 text-[#F4A100] shrink-0 mt-0.5" />
          <p>
            Arrival estimates are calculated from live GPS feeds & published schedules. Data provided for reference.
          </p>
        </div>
      </div>
    </div>
  );
}

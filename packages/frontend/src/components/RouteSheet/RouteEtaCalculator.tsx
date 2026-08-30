import { useState, useMemo, useEffect } from 'react';
import { ArrowUpDown, Clock, Radio, Sparkles } from 'lucide-react';
import type { RouteStopItem, LiveVehicle } from '@basbuddy/shared';
import { Combobox } from '../Combobox/Combobox.tsx';

interface RouteEtaCalculatorProps {
  stops: RouteStopItem[];
  vehicles: LiveVehicle[];
  onSelectStop?: (stopId: string) => void;
  initialOriginStopId?: string | null;
  initialDestStopId?: string | null;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function RouteEtaCalculator({
  stops,
  vehicles,
  onSelectStop,
  initialOriginStopId,
  initialDestStopId,
}: RouteEtaCalculatorProps) {
  const [originStopId, setOriginStopId] = useState<string>(() => {
    return initialOriginStopId || stops[0]?.stopId || '';
  });

  const [destStopId, setDestStopId] = useState<string>(() => {
    if (initialDestStopId && initialDestStopId !== originStopId) return initialDestStopId;
    return stops[Math.min(stops.length - 1, 5)]?.stopId || stops[stops.length - 1]?.stopId || '';
  });

  useEffect(() => {
    if (stops.length > 0) {
      if (!stops.some((s) => s.stopId === originStopId)) {
        setOriginStopId(initialOriginStopId && stops.some((s) => s.stopId === initialOriginStopId) ? initialOriginStopId : stops[0]!.stopId);
      }
      if (!stops.some((s) => s.stopId === destStopId)) {
        const fallbackDest = stops[Math.min(stops.length - 1, 5)]?.stopId || stops[stops.length - 1]!.stopId;
        setDestStopId(fallbackDest);
      }
    }
  }, [stops, initialOriginStopId, originStopId, destStopId]);

  const originIndex = useMemo(() => {
    return stops.findIndex((s) => s.stopId === originStopId);
  }, [stops, originStopId]);

  const destIndex = useMemo(() => {
    return stops.findIndex((s) => s.stopId === destStopId);
  }, [stops, destStopId]);

  const originStop = stops[originIndex];
  const destStop = stops[destIndex];

  const originStopOption = useMemo(
    () => stops.find((s) => s.stopId === originStopId) ?? null,
    [stops, originStopId],
  );

  const destStopOption = useMemo(
    () => stops.find((s) => s.stopId === destStopId) ?? null,
    [stops, destStopId],
  );

  const isValidTrip = originIndex !== -1 && destIndex !== -1 && destIndex > originIndex;
  const stopsCount = isValidTrip ? destIndex - originIndex : 0;

  // Calculate cumulative distance
  const distanceMeters = useMemo(() => {
    if (!isValidTrip) return 0;
    let dist = 0;
    for (let i = originIndex; i < destIndex; i++) {
      const s1 = stops[i]!;
      const s2 = stops[i + 1]!;
      dist += haversineMeters(s1.lat, s1.lon, s2.lat, s2.lon);
    }
    return Math.round(dist);
  }, [stops, originIndex, destIndex, isValidTrip]);

  // Average speed in urban transit ~22 km/h + 30s per stop dwell time
  const transitDurationMinutes = useMemo(() => {
    if (!isValidTrip || distanceMeters === 0) return 0;
    const drivingTimeSec = (distanceMeters / (22 * 1000)) * 3600;
    const dwellTimeSec = stopsCount * 30;
    return Math.max(2, Math.round((drivingTimeSec + dwellTimeSec) / 60));
  }, [isValidTrip, distanceMeters, stopsCount]);

  // Check for oncoming live vehicles approaching the origin stop
  const oncomingBus = useMemo(() => {
    if (!isValidTrip || !originStop) return null;
    const liveVehicles = vehicles.filter((v) => v.freshness === 'live' || v.freshness === 'stale');
    if (liveVehicles.length === 0) return null;

    // Find vehicle nearest to a stop that is before or at originIndex
    let bestMatch: { vehicle: LiveVehicle; stopsAway: number; etaMinutes: number } | null = null;

    for (const v of liveVehicles) {
      let vStopIndex = stops.findIndex((s) => s.stopId === v.nearestStopId);
      if (vStopIndex === -1) {
        // Fallback: find closest stop by distance
        let minDist = Infinity;
        for (let i = 0; i < stops.length; i++) {
          const st = stops[i]!;
          const d = haversineMeters(v.lat, v.lon, st.lat, st.lon);
          if (d < minDist) {
            minDist = d;
            vStopIndex = i;
          }
        }
      }

      if (vStopIndex !== -1 && vStopIndex <= originIndex) {
        const stopsAway = originIndex - vStopIndex;
        // Estimate 1.5 min per stop distance
        const etaMinutes = Math.max(1, Math.round(stopsAway * 1.8));

        if (!bestMatch || stopsAway < bestMatch.stopsAway) {
          bestMatch = { vehicle: v, stopsAway, etaMinutes };
        }
      }
    }

    return bestMatch;
  }, [isValidTrip, originStop, originIndex, vehicles, stops]);

  const handleSwap = () => {
    setOriginStopId(destStopId);
    setDestStopId(originStopId);
  };

  const formatTime = (timeStr?: string | null) => {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    let h = parseInt(parts[0] ?? '0', 10);
    const m = parts[1] ?? '00';
    if (h >= 24) h -= 24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 === 0 ? 12 : h % 12;
    return `${formattedH}:${m} ${ampm}`;
  };

  return (
    <div className="space-y-4">
      {/* Origin & Destination Pickers */}
      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
        <div className="text-xs font-mono uppercase tracking-wider text-[#F4A100] flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#F4A100]" />
            <span>Trip & ETA Calculator</span>
          </span>
          <button
            type="button"
            onClick={handleSwap}
            title="Swap Origin and Destination"
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/15 text-[#FFF8EE]/70 hover:text-[#FFF8EE] text-[10px] font-sans transition-all active:scale-95"
          >
            <ArrowUpDown className="w-3 h-3" />
            <span>Swap</span>
          </button>
        </div>

        {/* Boarding Stop (From) */}
        <div className="relative z-30">
          <label className="text-[11px] font-sans font-medium text-[#FFF8EE]/60 flex items-center gap-1 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#1F7A6C]" />
            <span>Boarding Stop (From)</span>
          </label>
          <Combobox<RouteStopItem>
            options={stops}
            value={originStopOption}
            onChange={(stop) => setOriginStopId(stop.stopId)}
            getOptionKey={(stop) => stop.stopId}
            getOptionLabel={(stop) => {
              const idx = stops.findIndex((s) => s.stopId === stop.stopId);
              return `#${idx + 1} ${stop.stopName} (${stop.stopId})`;
            }}
            renderOption={(stop) => {
              const idx = stops.findIndex((s) => s.stopId === stop.stopId);
              return (
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-white/10 text-[9px] font-mono text-[#F4A100] flex items-center justify-center font-bold shrink-0">
                    {idx + 1}
                  </span>
                  <span className="truncate">{stop.stopName}</span>
                  <span className="text-[10px] font-mono text-[#FFF8EE]/40">({stop.stopId})</span>
                </div>
              );
            }}
            ariaLabel="Boarding Stop"
            placeholder="Search boarding stop..."
          />
        </div>

        {/* Alighting Stop (To) */}
        <div className="relative z-20">
          <label className="text-[11px] font-sans font-medium text-[#FFF8EE]/60 flex items-center gap-1 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#FF5A47]" />
            <span>Alighting Stop (To)</span>
          </label>
          <Combobox<RouteStopItem>
            options={stops}
            value={destStopOption}
            onChange={(stop) => setDestStopId(stop.stopId)}
            getOptionKey={(stop) => stop.stopId}
            getOptionLabel={(stop) => {
              const idx = stops.findIndex((s) => s.stopId === stop.stopId);
              return `#${idx + 1} ${stop.stopName} (${stop.stopId})`;
            }}
            renderOption={(stop) => {
              const idx = stops.findIndex((s) => s.stopId === stop.stopId);
              return (
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-white/10 text-[9px] font-mono text-[#F4A100] flex items-center justify-center font-bold shrink-0">
                    {idx + 1}
                  </span>
                  <span className="truncate">{stop.stopName}</span>
                  <span className="text-[10px] font-mono text-[#FFF8EE]/40">({stop.stopId})</span>
                </div>
              );
            }}
            ariaLabel="Alighting Stop"
            placeholder="Search alighting stop..."
          />
        </div>
      </div>

      {/* Trip Calculation Output Card */}
      {!isValidTrip ? (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-sans text-center">
          <p className="font-semibold">Selected destination is before origin</p>
          <p className="text-[11px] text-amber-200/70 mt-1">
            Please pick a destination stop that is downstream along this direction.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary metrics strip */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-center">
              <div className="text-[10px] font-mono text-[#FFF8EE]/40 uppercase">Est. Duration</div>
              <div className="text-base font-display font-bold text-[#F4A100] mt-0.5">
                ~{transitDurationMinutes} min
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-center">
              <div className="text-[10px] font-mono text-[#FFF8EE]/40 uppercase">Stops Away</div>
              <div className="text-base font-display font-bold text-[#FFF8EE] mt-0.5">
                {stopsCount} {stopsCount === 1 ? 'stop' : 'stops'}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-center">
              <div className="text-[10px] font-mono text-[#FFF8EE]/40 uppercase">Distance</div>
              <div className="text-base font-display font-bold text-[#FFF8EE] mt-0.5">
                {(distanceMeters / 1000).toFixed(1)} km
              </div>
            </div>
          </div>

          {/* Live Bus ETA Forecast */}
          {oncomingBus ? (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
              <div className="flex items-center gap-2 text-xs font-sans font-bold text-emerald-300 mb-1.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400">
                  <Radio className="w-3 h-3 animate-pulse" />
                </span>
                <span>Live Oncoming Bus Detected!</span>
              </div>
              <p className="text-xs font-sans text-[#FFF8EE]/90 leading-relaxed">
                Bus is <strong className="text-emerald-300">{oncomingBus.stopsAway === 0 ? 'at your stop' : `${oncomingBus.stopsAway} stops away`}</strong> (~{oncomingBus.etaMinutes} min to boarding).
              </p>
              <div className="mt-2 pt-2 border-t border-emerald-500/20 flex items-center justify-between text-xs font-mono">
                <span className="text-[#FFF8EE]/60">Total trip with wait:</span>
                <span className="font-bold text-emerald-300">
                  ~{oncomingBus.etaMinutes + transitDurationMinutes} mins
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-sans text-[#FFF8EE]/70 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#F4A100] shrink-0" />
              <span>
                {originStop?.scheduledTime ? (
                  <>
                    Next scheduled departure at{' '}
                    <strong className="text-[#FFF8EE] font-mono">
                      {formatTime(originStop.scheduledTime)}
                    </strong>
                  </>
                ) : (
                  'No live bus approaching origin. Showing schedule estimates.'
                )}
              </span>
            </div>
          )}

          {/* Stop progression visual strip */}
          <div className="p-3 rounded-2xl bg-[#101B2D]/80 border border-white/10 space-y-2 text-xs font-sans">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#FFF8EE]/50">
              <span>Trip Route Preview</span>
              <span>#{originIndex + 1} ➔ #{destIndex + 1}</span>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="flex flex-col items-center shrink-0 mt-0.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1F7A6C] ring-2 ring-[#1F7A6C]/30" />
                <span className="w-0.5 h-6 bg-white/20 my-0.5" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF5A47] ring-2 ring-[#FF5A47]/30" />
              </div>

              <div className="flex-1 space-y-2 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-[#FFF8EE] truncate max-w-[200px]">
                    {originStop?.stopName}
                  </div>
                  {onSelectStop && originStop && (
                    <button
                      type="button"
                      onClick={() => onSelectStop(originStop.stopId)}
                      className="text-[10px] text-[#F4A100] hover:underline font-mono"
                    >
                      View Stop
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="font-medium text-[#FFF8EE] truncate max-w-[200px]">
                    {destStop?.stopName}
                  </div>
                  {onSelectStop && destStop && (
                    <button
                      type="button"
                      onClick={() => onSelectStop(destStop.stopId)}
                      className="text-[10px] text-[#F4A100] hover:underline font-mono"
                    >
                      View Stop
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

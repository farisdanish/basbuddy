import { useState, useMemo } from 'react';
import { Bus, Radio, Navigation, Clock, ChevronRight, Calendar } from 'lucide-react';
import type { RouteDetailsResponse, RouteStopItem, LiveVehicle } from '@basbuddy/shared';
import {
  buildRouteStopsLookup,
  findVehicleStopProgress,
  getVehicleMovementState,
  formatRelativeGpsAge,
} from '../../utils/vehicleStatus.ts';

interface RouteVehiclesTabProps {
  routeData: RouteDetailsResponse;
  activeDirectionIndex: number;
  activeStops: RouteStopItem[];
  dwellMinutesMap: Map<string, number>;
  onSelectStop?: (stopId: string) => void;
  onSwitchTab?: (tab: 'timeline' | 'schedule') => void;
}

export function RouteVehiclesTab({
  routeData,
  activeDirectionIndex,
  activeStops,
  dwellMinutesMap,
  onSelectStop,
  onSwitchTab,
}: RouteVehiclesTabProps) {
  const [filterMode, setFilterMode] = useState<'direction' | 'all'>('direction');

  const directions = routeData.directions ?? [];
  const activeDirection = directions[activeDirectionIndex] ?? directions[0];
  const allVehicles = routeData.vehicles ?? [];

  // Build unified stop lookup across all directions for cross-direction resolving
  const stopsLookup = useMemo(() => {
    return buildRouteStopsLookup(directions, routeData.stops ?? []);
  }, [directions, routeData.stops]);

  // Set of stop IDs belonging to the active direction
  const activeDirectionStopIds = useMemo(() => {
    return new Set(activeStops.map((s) => s.stopId));
  }, [activeStops]);

  // Filter vehicles for active direction vs all
  const directionVehicles = useMemo(() => {
    return allVehicles.filter((v) => {
      if (v.directionId !== undefined && v.directionId !== null) {
        return activeDirection ? v.directionId === activeDirection.directionId : true;
      }
      if (!v.nearestStopId) return true;
      return activeDirectionStopIds.has(v.nearestStopId);
    });
  }, [allVehicles, activeDirection?.directionId, activeDirectionStopIds]);

  const displayedVehicles: LiveVehicle[] = filterMode === 'direction' ? directionVehicles : allVehicles;
  const liveCount = allVehicles.filter((v) => v.freshness === 'live').length;

  return (
    <div className="space-y-3" data-testid="route-vehicles-tab">
      {/* Fleet Overview Ribbon */}
      <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                liveCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400/80'
              }`}
            />
            <span className="text-xs font-sans font-semibold text-[#FFF8EE]">
              {allVehicles.length > 0
                ? `${allVehicles.length} active ${allVehicles.length === 1 ? 'bus' : 'buses'} tracking`
                : 'No active buses broadcasting'}
            </span>
          </div>

          <span className="text-[11px] font-mono text-[#FFF8EE]/50">
            {activeStops.length} stops on line
          </span>
        </div>

        {/* Direction vs All filter toggles */}
        {directions.length > 1 && allVehicles.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#101B2D]/70 border border-white/5">
            <button
              type="button"
              onClick={() => setFilterMode('direction')}
              className={`py-1.5 px-2 rounded-lg text-xs font-sans font-medium transition-all truncate text-center ${
                filterMode === 'direction'
                  ? 'bg-[#1F7A6C] text-[#FFF8EE] font-semibold shadow-sm'
                  : 'text-[#FFF8EE]/60 hover:text-[#FFF8EE] hover:bg-white/5'
              }`}
            >
              This Direction ({directionVehicles.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`py-1.5 px-2 rounded-lg text-xs font-sans font-medium transition-all truncate text-center ${
                filterMode === 'all'
                  ? 'bg-[#1F7A6C] text-[#FFF8EE] font-semibold shadow-sm'
                  : 'text-[#FFF8EE]/60 hover:text-[#FFF8EE] hover:bg-white/5'
              }`}
            >
              All Buses ({allVehicles.length})
            </button>
          </div>
        )}
      </div>

      {/* Empty State when 0 buses tracking */}
      {displayedVehicles.length === 0 && (
        <div className="text-center py-8 px-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/5 border border-white/10 mx-auto text-[#F4A100]">
            <Radio className="w-6 h-6 opacity-70" />
          </div>
          <div>
            <h3 className="text-sm font-sans font-bold text-[#FFF8EE]">
              {filterMode === 'direction' && allVehicles.length > 0
                ? 'No buses active in this direction'
                : 'No active GPS signal detected'}
            </h3>
            <p className="text-xs font-sans text-[#FFF8EE]/60 mt-1 max-w-xs mx-auto">
              {filterMode === 'direction' && allVehicles.length > 0
                ? 'There are buses operating on the return direction of this route.'
                : 'Vehicles may be in holding terminals or between scheduled dispatch runs.'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 pt-1">
            {filterMode === 'direction' && allVehicles.length > 0 ? (
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F4A100] hover:bg-[#F4A100]/90 text-[#101B2D] text-xs font-sans font-bold transition-all shadow-sm"
              >
                <Bus className="w-3.5 h-3.5" />
                <span>View all {allVehicles.length} buses</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onSwitchTab && onSwitchTab('timeline')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-[#FFF8EE] text-xs font-sans font-medium transition-all"
                >
                  <Bus className="w-3.5 h-3.5 text-[#F4A100]" />
                  <span>Stop Timeline</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchTab && onSwitchTab('schedule')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-[#FFF8EE] text-xs font-sans font-medium transition-all"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#F4A100]" />
                  <span>Timetable</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Vehicle Cards List */}
      {displayedVehicles.length > 0 && (
        <div className="space-y-2.5">
          {displayedVehicles.map((vehicle, idx) => {
            const dwellMinutes = dwellMinutesMap.get(vehicle.tripId) ?? 0;
            const movementState = getVehicleMovementState(dwellMinutes, vehicle.speedKmh);
            const relativeGps = formatRelativeGpsAge(vehicle.timestamp);

            // Resolve matching direction per vehicle for accurate headsign & sequence in All Buses mode
            const vehicleDir =
              vehicle.directionId !== undefined && vehicle.directionId !== null
                ? directions.find((d) => d.directionId === vehicle.directionId)
                : directions.find((d) => d.stops?.some((s) => s.stopId === vehicle.nearestStopId)) ?? activeDirection;

            const vehicleHeadsign = vehicleDir?.tripHeadsign || activeDirection?.tripHeadsign || `Bus ${idx + 1}`;
            const vehicleDirStops = vehicleDir?.stops && vehicleDir.stops.length > 0 ? vehicleDir.stops : activeStops;
            const progress = findVehicleStopProgress(vehicle, stopsLookup, vehicleDirStops);

            const isLive = vehicle.freshness === 'live';
            const isStale = vehicle.freshness === 'stale';

            return (
              <div
                key={vehicle.tripId || `bus-${idx}`}
                onClick={() => vehicle.nearestStopId && onSelectStop && onSelectStop(vehicle.nearestStopId)}
                className="group relative p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all cursor-pointer text-[#FFF8EE] space-y-2"
                data-testid={`vehicle-card-${vehicle.tripId}`}
              >
                {/* Header Row: Destination / Trip identifier & Freshness */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#F4A100] text-[#101B2D] font-display font-bold text-xs shrink-0 shadow-sm">
                      {routeData.routeShortName}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-sans font-bold text-[#FFF8EE] truncate">
                        {vehicleHeadsign}
                      </div>
                      <div className="text-[10px] font-mono text-[#FFF8EE]/40 truncate">
                        Trip ID: {vehicle.tripId}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isLive ? 'bg-emerald-400 animate-pulse' : isStale ? 'bg-amber-400' : 'bg-rose-400'
                      }`}
                    />
                    <span className="text-[10px] font-mono text-[#FFF8EE]/50">
                      {relativeGps}
                    </span>
                  </div>
                </div>

                {/* Status & Next Stop row */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-sans font-semibold ${movementState.badgeClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${movementState.pulseClass}`} />
                    {movementState.label}
                  </span>

                  {progress.nextStop && (
                    <div className="text-[11px] font-sans text-[#FFF8EE]/70 truncate flex items-center gap-1">
                      <span className="text-[#FFF8EE]/40 font-mono">Next:</span>
                      <span className="truncate max-w-[150px]">{progress.nextStop.stopName}</span>
                    </div>
                  )}
                </div>

                {/* Progress Details & Sequence Position */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-[#101B2D]/60 border border-white/5 text-xs font-sans">
                  <div className="flex items-center gap-2 min-w-0">
                    {progress.stopSequence !== null && (
                      <span className="flex items-center justify-center w-5 h-5 rounded-md bg-white/10 text-[10px] font-mono font-bold text-[#F4A100] shrink-0">
                        #{progress.stopSequence}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[#FFF8EE] truncate">
                        {progress.nearestStop?.stopName || 'Approaching stop'}
                      </div>
                      <div className="text-[10px] font-mono text-[#FFF8EE]/40 truncate">
                        {vehicle.nearestStopId || 'Position tracking'}
                        {progress.stopsRemaining !== null && ` • ${progress.stopsRemaining} stops to terminus`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {vehicle.bearing !== null && vehicle.bearing !== undefined && (
                      <div
                        className="flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10 text-[#F4A100]"
                        title={`Heading ${Math.round(vehicle.bearing)}°`}
                      >
                        <Navigation
                          className="w-3.5 h-3.5"
                          style={{ transform: `rotate(${Math.round(vehicle.bearing)}deg)` }}
                        />
                      </div>
                    )}
                    <ChevronRight className="w-4 h-4 text-[#FFF8EE]/30 group-hover:text-[#FFF8EE] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dwell Session Observation Note */}
      <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-start gap-2 text-[10px] font-sans text-[#FFF8EE]/40">
        <Clock className="w-3.5 h-3.5 text-[#F4A100] shrink-0 mt-0.5" />
        <p>
          Stationary dwell times and stop progress are observed live during the active session. Tap any bus card to highlight its position on the map and stop timeline.
        </p>
      </div>
    </div>
  );
}

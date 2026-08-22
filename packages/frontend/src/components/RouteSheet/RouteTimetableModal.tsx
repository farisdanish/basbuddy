import { useState } from 'react';
import { X, Clock, Calendar, Navigation, Info } from 'lucide-react';
import type { RouteDetailsResponse } from '@basbuddy/shared';

interface RouteTimetableModalProps {
  isOpen: boolean;
  onClose: () => void;
  routeData: RouteDetailsResponse;
}

export function RouteTimetableModal({
  isOpen,
  onClose,
  routeData,
}: RouteTimetableModalProps) {
  const [activeDirectionId, setActiveDirectionId] = useState<number>(() => {
    return routeData.directions[0]?.directionId ?? 0;
  });

  if (!isOpen) return null;

  const timetable = routeData.timetable;
  const directions = routeData.directions ?? [];
  const allDepartures = timetable?.allDepartures ?? [];

  // Filter departures for the active direction (if directionId is provided in departures, or all if single direction)
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

  const nextDepartureTripId = timetable?.nextDepartures[0]?.tripId;

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="timetable-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl bg-[#182337] border border-white/15 shadow-2xl overflow-hidden text-[#FFF8EE]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-[#101B2D]/80">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center px-3 h-9 rounded-xl bg-[#F4A100] text-[#101B2D] font-display font-bold text-base shadow-sm shrink-0">
              {routeData.routeShortName}
            </div>
            <div>
              <h2 id="timetable-modal-title" className="text-base font-sans font-bold text-[#FFF8EE] leading-tight">
                Scheduled Timetable
              </h2>
              <p className="text-xs font-mono text-[#FFF8EE]/50 truncate max-w-[260px]">
                {routeData.routeLongName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close timetable"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-[#FFF8EE]/80 hover:text-[#FFF8EE] active:scale-95 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Operating hours & summary ribbon */}
        <div className="grid grid-cols-2 gap-2 p-4 bg-white/[0.02] border-b border-white/5 text-xs font-sans">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/5">
            <Clock className="w-4 h-4 text-[#F4A100] shrink-0" />
            <div>
              <div className="text-[10px] font-mono text-[#FFF8EE]/40 uppercase">First Bus</div>
              <div className="font-bold text-[#FFF8EE]">
                {timetable?.firstBusTime ? formatTimeDisplay(timetable.firstBusTime) : 'N/A'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/5">
            <Calendar className="w-4 h-4 text-[#1F7A6C] shrink-0" />
            <div>
              <div className="text-[10px] font-mono text-[#FFF8EE]/40 uppercase">Last Bus</div>
              <div className="font-bold text-[#FFF8EE]">
                {timetable?.lastBusTime ? formatTimeDisplay(timetable.lastBusTime) : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Direction Selector Tabs if multiple directions exist */}
        {directions.length > 1 && (
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-[#101B2D]/40 overflow-x-auto no-scrollbar">
            {directions.map((dir) => (
              <button
                key={`${dir.directionId}-${dir.tripHeadsign}`}
                type="button"
                onClick={() => setActiveDirectionId(dir.directionId)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-sans font-medium transition-all shrink-0 ${
                  activeDirectionId === dir.directionId
                    ? 'bg-[#1F7A6C] text-[#FFF8EE] shadow-sm ring-1 ring-white/20'
                    : 'bg-white/5 text-[#FFF8EE]/60 hover:bg-white/10'
                }`}
              >
                <Navigation className="w-3 h-3" />
                <span>{dir.tripHeadsign || `Direction ${dir.directionId}`}</span>
              </button>
            ))}
          </div>
        )}

        {/* Departures Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 basbuddy-scroll">
          {dirDepartures.length === 0 ? (
            <div className="text-center py-10 text-sm font-sans text-[#FFF8EE]/50">
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
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
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
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
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
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
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

          {/* Open Data explanation footer note */}
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#101B2D] border border-white/10 text-xs font-sans text-[#FFF8EE]/60">
            <Info className="w-4 h-4 text-[#F4A100] shrink-0 mt-0.5" />
            <div>
              <p className="leading-relaxed">
                Departure times are published timetables from Prasarana via <span className="text-[#FFF8EE] font-semibold">data.gov.my</span>.
              </p>
              <p className="mt-1 text-[11px] text-[#FFF8EE]/40 leading-normal">
                Actual road departure times may vary with traffic and depot dispatch. Real-time GPS telemetry is displayed on the live map when available.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

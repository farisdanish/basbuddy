import { useState, useEffect } from 'react';
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
      aria-labelledby="timetable-pane-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200 md:bg-transparent md:backdrop-blur-none md:p-0 md:pointer-events-none md:inset-auto md:top-20 md:right-6 md:w-96 md:max-h-[calc(100vh-12rem)] md:block"
    >
      <div className="relative w-full max-w-lg max-h-[85vh] md:max-h-[calc(100vh-12rem)] md:w-96 flex flex-col rounded-2xl bg-[#182337]/95 border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden text-[#FFF8EE] md:pointer-events-auto transition-all animate-in md:slide-in-from-right-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-4 border-b border-white/10 bg-[#101B2D]/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center min-w-[44px] h-9 px-2.5 rounded-xl bg-[#F4A100] text-[#101B2D] font-display text-lg font-bold shadow-md shrink-0 select-none">
              {routeData.routeShortName}
            </div>
            <div className="min-w-0">
              <h2 id="timetable-pane-title" className="text-sm font-sans font-bold text-[#FFF8EE] leading-tight truncate">
                Scheduled Timetable
              </h2>
              <p className="text-xs font-mono text-[#FFF8EE]/50 truncate max-w-[200px]">
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

        {/* Operating hours & summary ribbon */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-white/[0.02] border-b border-white/5 text-xs font-sans shrink-0">
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

        {/* Direction Selector Tabs if multiple directions exist */}
        {directions.length > 1 && (
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5 bg-[#101B2D]/40 overflow-x-auto no-scrollbar shrink-0">
            {directions.map((dir) => (
              <button
                key={`${dir.directionId}-${dir.tripHeadsign}`}
                type="button"
                onClick={() => setActiveDirectionId(dir.directionId)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans font-medium transition-all shrink-0 ${
                  activeDirectionId === dir.directionId
                    ? 'bg-[#1F7A6C] text-[#FFF8EE] shadow-sm ring-1 ring-white/20'
                    : 'bg-white/5 text-[#FFF8EE]/60 hover:bg-white/10'
                }`}
              >
                <Navigation className="w-3 h-3" />
                <span className="truncate max-w-[140px]">{dir.tripHeadsign || `Direction ${dir.directionId}`}</span>
              </button>
            ))}
          </div>
        )}

        {/* Departures Content */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4 basbuddy-scroll min-h-0">
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

          {/* Open Data explanation footer note */}
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#101B2D] border border-white/10 text-xs font-sans text-[#FFF8EE]/60">
            <Info className="w-4 h-4 text-[#F4A100] shrink-0 mt-0.5" />
            <div>
              <p className="leading-relaxed">
                Departure times are published timetables from Prasarana via <span className="text-[#FFF8EE] font-semibold">data.gov.my</span>.
              </p>
              <p className="mt-1 text-[11px] text-[#FFF8EE]/40 leading-normal">
                Actual road departure times may vary with traffic and depot dispatch.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

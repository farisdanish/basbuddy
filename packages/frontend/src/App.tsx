import { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import { Github } from 'lucide-react';
import { useGeolocation } from './hooks/useGeolocation.ts';
import { useNearbyStops } from './hooks/useNearbyStops.ts';
import { useSystemHealth } from './hooks/useSystemHealth.ts';
import { useRouteDetails } from './hooks/useRouteDetails.ts';
import { BRAND_CONFIG } from './config/branding.ts';
import { smoothFlyTo, getTargetCenter, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from './lib/mapUtils.ts';

import { StopMarkersLayer } from './components/Map/StopMarkersLayer.tsx';
import { VehicleMarkersLayer } from './components/Map/VehicleMarkersLayer.tsx';
import { VehicleTrailsLayer } from './components/Map/VehicleTrailsLayer.tsx';
import { RoutePolylineLayer } from './components/Map/RoutePolylineLayer.tsx';
import { UserLocationMarker } from './components/Map/UserLocationMarker.tsx';
import { RecenterButton } from './components/Map/RecenterButton.tsx';
import { MapAutoCenter } from './components/Map/MapAutoCenter.tsx';

import { SearchHeader } from './components/Search/SearchHeader.tsx';
import { SearchOverlay } from './components/Search/SearchOverlay.tsx';
import { DegradedBanner } from './components/DegradedBanner.tsx';
import { RouteTrackerSheet } from './components/RouteSheet/RouteTrackerSheet.tsx';

import { StopSheet } from './components/StopSheet/StopSheet.tsx';
import { FavoritesList } from './components/FavoritesList/FavoritesList.tsx';
import { FavoritesModal } from './components/FavoritesList/FavoritesModal.tsx';
import { InfoModal, type InfoTabType } from './components/Info/InfoModal.tsx';
import { NavigationDrawer } from './components/NavigationDrawer/NavigationDrawer.tsx';
import { ToastContainer } from './components/Toast/Toast.tsx';
import type { TransitHub } from './utils/transitHubs.ts';

// ── Time-of-day gradient (§11 signature element) ──────────────────────────────
function getTimeGradientClass(hour: number): string {
  if (hour >= 5 && hour < 7)   return 'gradient-dawn';
  if (hour >= 7 && hour < 11)  return 'gradient-morning';
  if (hour >= 11 && hour < 16) return 'gradient-midday';
  if (hour >= 16 && hour < 19) return 'gradient-golden';
  if (hour >= 19 && hour < 21) return 'gradient-dusk';
  return 'gradient-night';
}

function MapViewportSync({ onCenterChange }: { onCenterChange: (center: [number, number]) => void }) {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();
      onCenterChange([c.lat, c.lng]);
    },
  });
  return null;
}

const LAST_VIEWED_KEY = 'basbuddy:lastViewed';
const LAST_VIEWED_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface LastViewedState {
  routeId: string | null;
  stopId: string | null;
  timestamp: number;
}

function getSavedLastViewed(): LastViewedState | null {
  try {
    const raw = localStorage.getItem(LAST_VIEWED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastViewedState;
    if (Date.now() - parsed.timestamp < LAST_VIEWED_MAX_AGE_MS) {
      return parsed;
    }
  } catch {
    // Ignore corrupt storage
  }
  return null;
}

export default function App() {
  const [gradientClass, setGradientClass] = useState(() => {
    const klHour = new Date().toLocaleString('en-MY', {
      timeZone: 'Asia/Kuala_Lumpur',
      hour: 'numeric',
      hour12: false,
    });
    return getTimeGradientClass(parseInt(klHour, 10));
  });

  // Update gradient every 5 minutes
  useEffect(() => {
    const update = () => {
      const klHour = parseInt(
        new Date().toLocaleString('en-MY', {
          timeZone: 'Asia/Kuala_Lumpur',
          hour: 'numeric',
          hour12: false,
        }),
        10,
      );
      setGradientClass(getTimeGradientClass(klHour));
    };
    const id = setInterval(update, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const { position } = useGeolocation();
  const initialCenter: [number, number] = getTargetCenter(position, DEFAULT_MAP_CENTER);

  const [mapCenter, setMapCenter] = useState<[number, number]>(initialCenter);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(() => {
    // Support URL ?stop=KL1081 query param
    const params = new URLSearchParams(window.location.search);
    const stopParam = params.get('stop');
    if (stopParam) return stopParam;
    if (!params.get('route')) {
      const saved = getSavedLastViewed();
      if (saved?.stopId) return saved.stopId;
    }
    return null;
  });
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(() => {
    // Support URL ?route=1000001 query param
    const params = new URLSearchParams(window.location.search);
    const routeParam = params.get('route');
    if (routeParam) return routeParam;
    if (!params.get('stop')) {
      const saved = getSavedLastViewed();
      if (saved?.routeId) return saved.routeId;
    }
    return null;
  });
  const [selectedVehicleTripId, setSelectedVehicleTripId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [favoritesModalOpen, setFavoritesModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAgencyId, setSelectedAgencyId] = useState('all');
  const [infoModalTab, setInfoModalTab] = useState<InfoTabType | null>(null);

  const { stops } = useNearbyStops(mapCenter[0], mapCenter[1]);
  const { data: routeData, loading: routeLoading } = useRouteDetails(selectedRouteId);
  const health = useSystemHealth();

  // History management for mobile back gesture (Task #18)
  const historyDepthRef = useRef(0);
  const isHandlingBackViaUi = useRef(false);

  const pushOverlayHistory = useCallback(() => {
    historyDepthRef.current += 1;
    window.history.pushState({ basbuddyOverlay: true }, '');
  }, []);

  const handleCloseWithHistory = useCallback((closeFn: () => void) => {
    closeFn();
    if (historyDepthRef.current > 0) {
      isHandlingBackViaUi.current = true;
      window.history.back();
    }
  }, []);

  // Popstate listener for mobile back gestures
  useEffect(() => {
    const handlePopState = () => {
      if (historyDepthRef.current > 0) {
        historyDepthRef.current -= 1;
      }
      if (isHandlingBackViaUi.current) {
        isHandlingBackViaUi.current = false;
        return;
      }

      // Close topmost active overlay in priority order
      if (infoModalTab !== null) {
        setInfoModalTab(null);
      } else if (searchOpen) {
        setSearchOpen(false);
      } else if (favoritesModalOpen) {
        setFavoritesModalOpen(false);
      } else if (drawerOpen) {
        setDrawerOpen(false);
      } else if (selectedStopId !== null) {
        setSelectedStopId(null);
      } else if (selectedRouteId !== null) {
        setSelectedRouteId(null);
        setSelectedVehicleTripId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [infoModalTab, searchOpen, favoritesModalOpen, drawerOpen, selectedStopId, selectedRouteId]);

  // URL sync for ?route= and ?stop= (Task #19)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let changed = false;

    if (selectedRouteId) {
      if (params.get('route') !== selectedRouteId) {
        params.set('route', selectedRouteId);
        changed = true;
      }
    } else if (params.has('route')) {
      params.delete('route');
      changed = true;
    }

    if (selectedStopId) {
      if (params.get('stop') !== selectedStopId) {
        params.set('stop', selectedStopId);
        changed = true;
      }
    } else if (params.has('stop')) {
      params.delete('stop');
      changed = true;
    }

    if (changed) {
      const newQuery = params.toString();
      const newUrl = newQuery ? `${window.location.pathname}?${newQuery}` : window.location.pathname;
      window.history.replaceState(null, '', newUrl);
    }
  }, [selectedRouteId, selectedStopId]);

  // Persist last viewed stop/route to localStorage (Task #22)
  useEffect(() => {
    if (selectedRouteId || selectedStopId) {
      try {
        localStorage.setItem(
          LAST_VIEWED_KEY,
          JSON.stringify({
            routeId: selectedRouteId,
            stopId: selectedStopId,
            timestamp: Date.now(),
          }),
        );
      } catch {
        // Ignore quota limits
      }
    }
  }, [selectedRouteId, selectedStopId]);

  const handleCenterChange = useCallback((newCenter: [number, number]) => {
    setMapCenter(newCenter);
  }, []);

  const handleSelectStop = useCallback((stopId: string) => {
    if (!selectedStopId) {
      pushOverlayHistory();
    }
    setSelectedStopId(stopId);
  }, [selectedStopId, pushOverlayHistory]);

  const handleSelectRoute = useCallback((routeId: string) => {
    if (!selectedRouteId) {
      pushOverlayHistory();
    }
    setSelectedRouteId(routeId);
    setSelectedVehicleTripId(null);
  }, [selectedRouteId, pushOverlayHistory]);

  const handleSelectVehicle = useCallback((tripId: string) => {
    setSelectedVehicleTripId(tripId);
    if (routeData?.vehicles) {
      const v = routeData.vehicles.find((veh) => veh.tripId === tripId);
      if (v && window.__leafletMap) {
        smoothFlyTo(window.__leafletMap, [v.lat, v.lon], 16, 1.2, true);
      }
    }
  }, [routeData?.vehicles]);

  const handleSelectHub = useCallback((hub: TransitHub) => {
    setMapCenter([hub.lat, hub.lon]);
    if (window.__leafletMap) {
      smoothFlyTo(window.__leafletMap, [hub.lat, hub.lon], 15, 1.2, true);
    }
  }, []);

  const handleResetView = useCallback(() => {
    setSelectedRouteId(null);
    setSelectedStopId(null);
    setSelectedVehicleTripId(null);
    historyDepthRef.current = 0;
    const target = getTargetCenter(position, DEFAULT_MAP_CENTER);
    if (window.__leafletMap) {
      smoothFlyTo(window.__leafletMap, target, DEFAULT_MAP_ZOOM, 1.2, true);
    }
  }, [position]);

  // When a specific route is selected, show ONLY stops for that route; otherwise show nearby stops
  const activeStops = selectedRouteId
    ? (routeData?.stops ?? [])
    : stops;

  return (
    <div className={`relative h-full w-full overflow-hidden ${gradientClass}`}>
      {/* ── Full-Screen Map Canvas ─────────────────────────────────────────── */}
      <MapContainer
        center={initialCenter}
        zoom={DEFAULT_MAP_ZOOM}
        zoomControl={false}
        className="absolute inset-0 z-0"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapViewportSync onCenterChange={handleCenterChange} />
        <MapAutoCenter position={position} />
        <UserLocationMarker position={position} />
        <RoutePolylineLayer
          routeData={routeData}
        />
        <StopMarkersLayer
          stops={activeStops}
          selectedStopId={selectedStopId}
          onSelectStop={handleSelectStop}
        />
        <VehicleTrailsLayer
          routeId={selectedRouteId}
          vehicles={routeData?.vehicles ?? []}
        />
        <VehicleMarkersLayer
          routeId={selectedRouteId}
          vehicles={routeData?.vehicles ?? []}
          routeShortName={routeData?.routeShortName}
          selectedVehicleTripId={selectedVehicleTripId}
          onSelectVehicle={handleSelectVehicle}
        />
        <RecenterButton position={position} defaultCenter={DEFAULT_MAP_CENTER} />
      </MapContainer>

      {/* ── Top Floating Search & System Status ─────────────────────────────── */}
      <SearchHeader
        onOpenSearch={() => {
          pushOverlayHistory();
          setSearchOpen(true);
        }}
        onOpenInfo={() => {
          pushOverlayHistory();
          setInfoModalTab('about');
        }}
        onOpenDrawer={() => {
          pushOverlayHistory();
          setDrawerOpen(true);
        }}
        onResetView={handleResetView}
        systemStatus={health.status}
        pollerAgeSeconds={health.pollerAgeSeconds}
      />

      {/* ── Active Route Inspector Floating Card ─────────────────────────────── */}
      {selectedRouteId && (
        <RouteTrackerSheet
          routeData={routeData}
          loading={routeLoading}
          onClose={() => {
            handleCloseWithHistory(() => {
              setSelectedRouteId(null);
              setSelectedVehicleTripId(null);
            });
          }}
          onSelectStop={handleSelectStop}
          selectedStopId={selectedStopId}
          selectedVehicleTripId={selectedVehicleTripId}
          onSelectVehicle={handleSelectVehicle}
        />
      )}

      {/* ── Stale / Degraded Feed Warning Banner ─────────────────────────────── */}
      {!selectedRouteId && <DegradedBanner health={health} />}

      {/* ── Navigation Drawer & Hubs Directory ──────────────────────────────── */}
      <NavigationDrawer
        isOpen={drawerOpen}
        onClose={() => {
          handleCloseWithHistory(() => setDrawerOpen(false));
        }}
        selectedAgencyId={selectedAgencyId}
        onSelectAgency={setSelectedAgencyId}
        onSelectHub={handleSelectHub}
        onOpenFavorites={() => {
          setDrawerOpen(false);
          setFavoritesModalOpen(true);
        }}
        onOpenAbout={() => {
          setDrawerOpen(false);
          setInfoModalTab('about');
        }}
        onResetView={handleResetView}
      />

      {/* ── Search Modal Overlay ────────────────────────────────────────────── */}
      <SearchOverlay
        isOpen={searchOpen}
        onClose={() => {
          handleCloseWithHistory(() => setSearchOpen(false));
        }}
        onSelectStop={(stopId) => {
          setSearchOpen(false);
          handleSelectStop(stopId);
        }}
        onSelectRoute={(routeId) => {
          setSearchOpen(false);
          handleSelectRoute(routeId);
        }}
        userLocation={position}
      />

      {/* ── Bottom Favourites Tray ──────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-auto">
        <FavoritesList
          selectedStopId={selectedStopId}
          selectedRouteId={selectedRouteId}
          onSelectStop={handleSelectStop}
          onSelectRoute={handleSelectRoute}
          onOpenModal={() => {
            pushOverlayHistory();
            setFavoritesModalOpen(true);
          }}
        />
      </div>

      {/* ── Interactive Stop Detail Bottom Sheet ────────────────────────────── */}
      <StopSheet
        stopId={selectedStopId}
        onClose={() => {
          handleCloseWithHistory(() => setSelectedStopId(null));
        }}
        onSelectRoute={handleSelectRoute}
      />

      {/* ── Favorites Manager Modal Dialog ──────────────────────────────────── */}
      <FavoritesModal
        isOpen={favoritesModalOpen}
        onClose={() => {
          handleCloseWithHistory(() => setFavoritesModalOpen(false));
        }}
        onSelectStop={handleSelectStop}
        onSelectRoute={handleSelectRoute}
        selectedStopId={selectedStopId}
        selectedRouteId={selectedRouteId}
      />

      {/* ── Info / FAQ / Feedback Modal Dialog ──────────────────────────────── */}
      <InfoModal
        isOpen={infoModalTab !== null}
        initialTab={infoModalTab ?? 'about'}
        onClose={() => {
          handleCloseWithHistory(() => setInfoModalTab(null));
        }}
      />

      {/* ── CC BY 4.0 Attribution & Footer Links ────────────────────────────── */}
      <footer className="absolute bottom-1 left-2 z-20 text-[10px] font-sans text-[#FFF8EE]/40 pointer-events-none select-none flex items-center gap-1.5 flex-wrap">
        <span>Data: <a className="pointer-events-auto underline hover:text-[#FFF8EE]" href="https://data.gov.my" target="_blank" rel="noopener noreferrer">data.gov.my</a> / Prasarana ·{' '}
        <a className="pointer-events-auto underline hover:text-[#FFF8EE]" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a> ·{' '}
        Unofficial</span>
        <span className="hidden sm:inline">·</span>
        <a
          href={BRAND_CONFIG.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto inline-flex items-center gap-1 underline hover:text-[#F4A100] transition-colors"
          title="GitHub Repository"
        >
          <Github className="w-3 h-3 inline" />
          <span>GitHub</span>
        </a>
        <span className="hidden sm:inline">·</span>
        <button
          type="button"
          onClick={() => {
            pushOverlayHistory();
            setInfoModalTab('about');
          }}
          className="hidden sm:inline pointer-events-auto underline hover:text-[#F4A100] transition-colors"
        >
          About
        </button>
        <span className="hidden sm:inline">·</span>
        <button
          type="button"
          onClick={() => {
            pushOverlayHistory();
            setInfoModalTab('faq');
          }}
          className="hidden sm:inline pointer-events-auto underline hover:text-[#F4A100] transition-colors"
        >
          FAQ
        </button>
        <span className="hidden sm:inline">·</span>
        <button
          type="button"
          onClick={() => {
            pushOverlayHistory();
            setInfoModalTab('feedback');
          }}
          className="hidden sm:inline pointer-events-auto underline hover:text-[#F4A100] transition-colors"
        >
          Feedback
        </button>
      </footer>

      {/* ── Toast Notifications ────────────────────────────────────────────── */}
      <ToastContainer />
    </div>
  );
}

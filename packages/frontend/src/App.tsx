import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import { useGeolocation } from './hooks/useGeolocation.ts';
import { useNearbyStops } from './hooks/useNearbyStops.ts';
import { useSystemHealth } from './hooks/useSystemHealth.ts';

import { StopMarkersLayer } from './components/Map/StopMarkersLayer.tsx';
import { VehicleMarkersLayer } from './components/Map/VehicleMarkersLayer.tsx';
import { UserLocationMarker } from './components/Map/UserLocationMarker.tsx';
import { RecenterButton } from './components/Map/RecenterButton.tsx';

import { SearchHeader } from './components/Search/SearchHeader.tsx';
import { SearchOverlay } from './components/Search/SearchOverlay.tsx';
import { DegradedBanner } from './components/DegradedBanner.tsx';

import { StopSheet } from './components/StopSheet/StopSheet.tsx';
import { FavoritesList } from './components/FavoritesList/FavoritesList.tsx';

// ── Time-of-day gradient (§11 signature element) ──────────────────────────────
function getTimeGradientClass(hour: number): string {
  if (hour >= 5 && hour < 7)   return 'gradient-dawn';
  if (hour >= 7 && hour < 11)  return 'gradient-morning';
  if (hour >= 11 && hour < 16) return 'gradient-midday';
  if (hour >= 16 && hour < 19) return 'gradient-golden';
  if (hour >= 19 && hour < 21) return 'gradient-dusk';
  return 'gradient-night';
}

// KL city centre default (KL Sentral)
const KL_CENTER: [number, number] = [3.1390, 101.6869];
const DEFAULT_ZOOM = 14;

function MapViewportSync({ onCenterChange }: { onCenterChange: (center: [number, number]) => void }) {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();
      onCenterChange([c.lat, c.lng]);
    },
  });
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
  const initialCenter: [number, number] = position
    ? [position.lat, position.lon]
    : KL_CENTER;

  const [mapCenter, setMapCenter] = useState<[number, number]>(initialCenter);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(() => {
    // Support URL ?stop=KL1081 query param
    const params = new URLSearchParams(window.location.search);
    return params.get('stop');
  });
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const { stops } = useNearbyStops(mapCenter[0], mapCenter[1]);
  const health = useSystemHealth();

  const handleCenterChange = useCallback((newCenter: [number, number]) => {
    setMapCenter(newCenter);
  }, []);

  const handleSelectStop = useCallback((stopId: string) => {
    setSelectedStopId(stopId);
  }, []);

  const handleSelectRoute = useCallback((routeId: string) => {
    setSelectedRouteId(routeId);
  }, []);

  return (
    <div className={`relative h-full w-full overflow-hidden ${gradientClass}`}>
      {/* ── Top Floating Search & System Status ─────────────────────────────── */}
      <SearchHeader
        onOpenSearch={() => setSearchOpen(true)}
        systemStatus={health.status}
      />

      {/* ── Stale / Degraded Feed Warning Banner ─────────────────────────────── */}
      <DegradedBanner health={health} />

      {/* ── Full-Screen Map Canvas ─────────────────────────────────────────── */}
      <MapContainer
        center={initialCenter}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        className="absolute inset-0 z-0"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapViewportSync onCenterChange={handleCenterChange} />
        <UserLocationMarker position={position} />
        <StopMarkersLayer
          stops={stops}
          selectedStopId={selectedStopId}
          onSelectStop={handleSelectStop}
        />
        <VehicleMarkersLayer routeId={selectedRouteId} />
        <RecenterButton position={position} defaultCenter={KL_CENTER} />
      </MapContainer>

      {/* ── Search Modal Overlay ────────────────────────────────────────────── */}
      <SearchOverlay
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectStop={handleSelectStop}
        onSelectRoute={handleSelectRoute}
      />

      {/* ── Bottom Favourites Tray ──────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-auto">
        <FavoritesList
          selectedStopId={selectedStopId}
          onSelectStop={handleSelectStop}
        />
      </div>

      {/* ── Interactive Stop Detail Bottom Sheet ────────────────────────────── */}
      <StopSheet
        stopId={selectedStopId}
        onClose={() => setSelectedStopId(null)}
        onSelectRoute={handleSelectRoute}
      />

      {/* ── CC BY 4.0 Attribution Footer ────────────────────────────────────── */}
      <footer className="absolute bottom-1 left-2 z-20 text-[10px] font-sans text-[#FFF8EE]/40 pointer-events-none select-none">
        Data: <a className="pointer-events-auto underline" href="https://data.gov.my" target="_blank" rel="noopener noreferrer">data.gov.my</a> / Prasarana ·{' '}
        <a className="pointer-events-auto underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a> ·{' '}
        Unofficial
      </footer>
    </div>
  );
}

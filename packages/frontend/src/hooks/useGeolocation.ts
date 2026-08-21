import { useState, useEffect } from 'react';

// ─── useGeolocation ────────────────────────────────────────────────────────────
// Requests browser geolocation on first call. Used to populate the
// /api/stops?near= query param so "open and go" works without typing.
//
// Does NOT throw on denial — returns null position so the map falls back to
// the KL city centre default.

export interface GeoPosition {
  lat: number;
  lon: number;
  accuracy: number;
}

export interface UseGeolocationResult {
  position: GeoPosition | null;
  error: GeolocationPositionError | null;
  loading: boolean;
}

export function useGeolocation(): UseGeolocationResult {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<GeolocationPositionError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLoading(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 30_000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return { position, error, loading };
}

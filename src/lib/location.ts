/**
 * GPS do celular. Só é lido durante a viagem e com o app aberto (o navegador não lê em segundo plano).
 * Nunca bloqueia o fluxo: sem permissão ou sem sinal, devolve o erro e a viagem segue.
 */
export type GeoFix = { lat: number; lng: number; accuracyM: number | null; recordedAt: string };
export type GeoError = 'denied' | 'unavailable' | 'timeout';
export type GeoResult = GeoFix | { error: GeoError };

const OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 };

// O timeout do navegador só começa a contar depois que a permissão é dada. Este é o limite total,
// para não ficar esperando para sempre se o condutor ignorar o pedido de permissão.
const HARD_LIMIT_MS = 30_000;

// Alguns aparelhos devolvem o horário do GPS bagunçado: longe do relógio do celular, usa o relógio.
const MAX_CLOCK_DRIFT_MS = 2 * 60_000;

export function toFix(position: GeolocationPosition): GeoFix {
  const now = Date.now();
  const at = Math.abs(now - position.timestamp) < MAX_CLOCK_DRIFT_MS ? position.timestamp : now;
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracyM: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
    recordedAt: new Date(at).toISOString(),
  };
}

export function toGeoError(error: GeolocationPositionError): GeoError {
  if (error.code === error.PERMISSION_DENIED) return 'denied';
  if (error.code === error.TIMEOUT) return 'timeout';
  return 'unavailable';
}

export function getPosition(): Promise<GeoResult> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ error: 'unavailable' });
      return;
    }
    const timer = window.setTimeout(() => resolve({ error: 'timeout' }), HARD_LIMIT_MS);
    const done = (result: GeoResult) => {
      window.clearTimeout(timer);
      resolve(result);
    };
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => done(toFix(position)),
        (error) => done({ error: toGeoError(error) }),
        OPTIONS,
      );
    } catch {
      done({ error: 'unavailable' });
    }
  });
}

/** Distância em metros entre dois pontos (fórmula de haversine). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { distanceM, toFix, toGeoError } from '../lib/location';
import { enqueuePoint, flushPoints, recordPoint } from '../lib/pointQueue';
import { useOnline } from './useOnline';

/** Grava um ponto de percurso a cada 60 s ou 300 m, o que vier primeiro. */
const INTERVAL_MS = 60_000;
const DISTANCE_M = 300;
/** Leituras com precisão pior que isso são descartadas (GPS ainda procurando sinal). */
const MAX_ACCURACY_M = 100;
/** Envia a fila a cada tantos pontos de percurso. */
const FLUSH_EVERY = 10;

export type GpsStatus = 'aguardando' | 'ativo' | 'negado' | 'indisponivel';

/**
 * Registro do percurso enquanto a tela da viagem está aberta e visível.
 * Com a aba oculta o GPS para; ao voltar, retoma. Sem permissão, a viagem segue sem rota.
 */
export function useTripTracking(tripId: string, enabled: boolean) {
  const online = useOnline();
  const [gps, setGps] = useState<GpsStatus>('aguardando');
  const lastRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const sinceFlushRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (!('geolocation' in navigator)) {
      setGps('indisponivel');
      return;
    }
    let watchId: number | null = null;

    const onPosition = (position: GeolocationPosition) => {
      setGps('ativo');
      if (position.coords.accuracy > MAX_ACCURACY_M) return;
      const fix = toFix(position);
      const time = new Date(fix.recordedAt).getTime();
      const last = lastRef.current;
      if (last && time - last.time < INTERVAL_MS && distanceM(last, fix) < DISTANCE_M) return;
      lastRef.current = { lat: fix.lat, lng: fix.lng, time };
      enqueuePoint(tripId, 'percurso', fix);
      sinceFlushRef.current += 1;
      if (sinceFlushRef.current >= FLUSH_EVERY) {
        sinceFlushRef.current = 0;
        void flushPoints(tripId);
      }
    };

    const onError = (error: GeolocationPositionError) => {
      const reason = toGeoError(error);
      if (reason === 'denied') {
        setGps('negado');
        stop();
      } else if (reason === 'unavailable') {
        setGps('indisponivel');
      }
    };

    const start = () => {
      if (watchId !== null || document.visibilityState !== 'visible') return;
      watchId = navigator.geolocation.watchPosition(onPosition, onError, { enableHighAccuracy: true, maximumAge: 10_000 });
    };

    function stop() {
      if (watchId === null) return;
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }

    // Saindo do app: para o GPS e tenta mandar o que está na fila antes que o sistema feche a aba.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        start();
      } else {
        stop();
        void flushPoints(tripId);
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [tripId, enabled]);

  // Ao abrir a tela e sempre que a conexão voltar.
  useEffect(() => {
    if (enabled && online) void flushPoints(tripId);
  }, [tripId, enabled, online]);

  /** "Cheguei ao destino": grava uma parada e envia na hora. */
  const registerStop = useCallback(async () => {
    const result = await recordPoint(tripId, 'parada');
    if ('error' in result) {
      if (result.error === 'denied') setGps('negado');
    } else {
      void flushPoints(tripId);
    }
    return result;
  }, [tripId]);

  return { gps, registerStop };
}

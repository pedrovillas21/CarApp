import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchFleet, toAppError, type AppError, type FleetVehicle } from '../lib/api';

type FleetState = { data: FleetVehicle[] | null; error: AppError | null; loading: boolean };

const REFRESH_MS = 30_000;

/** Frota com status. Recarrega ao voltar para o app, ao reconectar e a cada 30 s. */
export function useFleet() {
  const [state, setState] = useState<FleetState>({ data: null, error: null, loading: true });
  const lastRequest = useRef(0);

  const reload = useCallback(async () => {
    const request = ++lastRequest.current;
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await fetchFleet();
      if (request === lastRequest.current) setState({ data, error: null, loading: false });
    } catch (err) {
      if (request === lastRequest.current) setState((s) => ({ data: s.data, error: toAppError(err), loading: false }));
    }
  }, []);

  useEffect(() => {
    void reload();
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('online', refreshIfVisible);
    const timer = window.setInterval(refreshIfVisible, REFRESH_MS);
    return () => {
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('online', refreshIfVisible);
      window.clearInterval(timer);
    };
  }, [reload]);

  return { ...state, reload };
}

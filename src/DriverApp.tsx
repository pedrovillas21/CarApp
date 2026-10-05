import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { useAuth, type Driver } from './auth/AuthProvider';
import { useFleet } from './hooks/useFleet';
import { useOnline } from './hooks/useOnline';
import {
  fetchOpenTrip,
  finishTrip,
  startTrip,
  toAppError,
  type AppError,
  type FinishedTrip,
  type FleetVehicle,
  type OpenTrip,
} from './lib/api';
import { ActiveTripScreen } from './screens/ActiveTripScreen';
import { DoneScreen } from './screens/DoneScreen';
import { HomeScreen } from './screens/HomeScreen';
import { KmScreen } from './screens/KmScreen';
import { SignatureScreen } from './screens/SignatureScreen';
import { SplashScreen } from './screens/SplashScreen';
import { StartTripScreen } from './screens/StartTripScreen';

type Screen = 'home' | 'start' | 'trip' | 'km' | 'sign' | 'done';
const TRIP_SCREENS: Screen[] = ['trip', 'km', 'sign'];

/**
 * Fluxo do condutor logado: Início → Iniciar viagem → Em viagem → KM final → Assinatura → Concluído.
 * Cada tela vira uma entrada no histórico, então o botão "voltar" do celular funciona.
 */
export function DriverApp({ driver }: { driver: Driver }) {
  const { signOut } = useAuth();
  const online = useOnline();
  const fleet = useFleet();
  const reloadFleet = fleet.reload;

  const [openTrip, setOpenTrip] = useState<OpenTrip | null | undefined>(undefined); // undefined = ainda não sabemos
  const [tripError, setTripError] = useState<AppError | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [kmEnd, setKmEnd] = useState<number | null>(null);
  const [finished, setFinished] = useState<FinishedTrip | null>(null);

  const openTripRef = useRef(openTrip);
  openTripRef.current = openTrip;

  const go = useCallback((next: Screen, { replace = false } = {}) => {
    const entry = { screen: next };
    if (replace) window.history.replaceState(entry, '');
    else window.history.pushState(entry, '');
    setScreen(next);
    window.scrollTo(0, 0);
  }, []);

  const back = useCallback(() => window.history.back(), []);

  // Botão voltar do celular: nunca volta para uma tela que não faz mais sentido.
  useEffect(() => {
    window.history.replaceState({ screen: 'home' }, '');
    const onPop = (event: PopStateEvent) => {
      const target = (event.state?.screen as Screen | undefined) ?? 'home';
      const hasTrip = Boolean(openTripRef.current);
      let next = target;
      if (hasTrip && !TRIP_SCREENS.includes(target)) next = 'trip';
      if (!hasTrip && (TRIP_SCREENS.includes(target) || target === 'done')) next = 'home';
      if (next !== target) window.history.replaceState({ screen: next }, '');
      setScreen(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const loadOpenTrip = useCallback(async () => {
    try {
      const trip = await fetchOpenTrip();
      setTripError(null);
      setOpenTrip(trip);
      openTripRef.current = trip;
      return trip;
    } catch (err) {
      setTripError(toAppError(err));
      return undefined;
    }
  }, []);

  // Ao abrir: se há viagem em aberto, vai direto para o cronômetro.
  useEffect(() => {
    void loadOpenTrip().then((trip) => {
      if (trip) go('trip', { replace: true });
    });
  }, [loadOpenTrip, go]);

  // Abriu sem internet: tenta de novo quando a conexão voltar.
  useEffect(() => {
    if (online && openTrip === undefined && tripError) {
      void loadOpenTrip().then((trip) => {
        if (trip) go('trip', { replace: true });
      });
    }
  }, [online, openTrip, tripError, loadOpenTrip, go]);

  const handleStart = useCallback(
    async (vehicle: FleetVehicle, destination: string) => {
      try {
        const trip = await startTrip(vehicle, destination);
        setOpenTrip(trip);
        openTripRef.current = trip;
        go('trip', { replace: true });
      } catch (err) {
        const error = toAppError(err);
        if (error.code === 'DRIVER_HAS_OPEN_TRIP') {
          const trip = await loadOpenTrip();
          if (trip) {
            go('trip', { replace: true });
            return;
          }
        }
        throw error;
      } finally {
        void reloadFleet();
      }
    },
    [go, loadOpenTrip, reloadFleet],
  );

  const handleSigned = useCallback(
    async (signature: Blob) => {
      const trip = openTripRef.current;
      if (!trip || kmEnd === null) return;
      const result = await finishTrip(driver.id, trip, kmEnd, signature);
      setFinished(result);
      setOpenTrip(null);
      openTripRef.current = null;
      setKmEnd(null);
      go('done', { replace: true });
      void reloadFleet();
    },
    [driver.id, kmEnd, go, reloadFleet],
  );

  // Tela efetiva: protege contra estados inconsistentes (ex.: voltar depois de concluir).
  let effective: Screen = screen;
  if (TRIP_SCREENS.includes(screen) && !openTrip) effective = 'home';
  if (screen === 'sign' && kmEnd === null) effective = openTrip ? 'km' : 'home';
  if (screen === 'done' && !finished) effective = 'home';
  if ((screen === 'home' || screen === 'start') && openTrip) effective = 'trip';

  let content: ReactNode;
  if (openTrip === undefined && !tripError) {
    content = <SplashScreen />;
  } else if (effective === 'start') {
    content = (
      <StartTripScreen fleet={fleet.data ?? []} online={online} onBack={back} onConfirm={handleStart} onConflict={() => void reloadFleet()} />
    );
  } else if (effective === 'trip' && openTrip) {
    content = (
      <ActiveTripScreen
        trip={openTrip}
        online={online}
        onFinish={() => {
          setKmEnd(null);
          go('km');
        }}
      />
    );
  } else if (effective === 'km' && openTrip) {
    content = (
      <KmScreen
        trip={openTrip}
        initialKm={kmEnd}
        onBack={back}
        onContinue={(km) => {
          setKmEnd(km);
          go('sign');
        }}
      />
    );
  } else if (effective === 'sign' && openTrip && kmEnd !== null) {
    content = (
      <SignatureScreen trip={openTrip} kmEnd={kmEnd} driverName={driver.fullName} online={online} onBack={back} onConfirm={handleSigned} />
    );
  } else if (effective === 'done' && finished) {
    content = <DoneScreen summary={finished} onHome={() => go('home', { replace: true })} />;
  } else {
    content = <HomeScreen driver={driver} fleet={fleet} online={online} onStart={() => go('start')} onSignOut={() => void signOut()} />;
  }

  const key = openTrip === undefined && !tripError ? 'loading' : effective;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={key}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -16 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        {content}
      </m.div>
    </AnimatePresence>
  );
}

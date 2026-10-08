import { useState, type ReactNode } from 'react';
import { m } from 'motion/react';
import { Button } from '../components/Button';
import { IconAlert, IconCar, IconFlag, IconFuel, IconGauge, IconPin } from '../components/Icons';
import { LogoTexto } from '../components/Logo';
import { Plate } from '../components/Plate';
import { useNow } from '../hooks/useNow';
import { useTripTracking } from '../hooks/useTripTracking';
import type { OpenTrip } from '../lib/api';
import { formatDuration, formatKm, formatTime } from '../lib/format';

type StopFeedback = { ok: true; at: string } | { ok: false; denied: boolean };

/** tracking: o condutor leu o aviso de localização; sem isso o GPS não é lido. */
export function ActiveTripScreen({ trip, online, tracking, onFinish }: {
  trip: OpenTrip;
  online: boolean;
  tracking: boolean;
  onFinish: () => void;
}) {
  // O tempo sai de started_at do banco: fechar o app ou trocar de aparelho não zera o cronômetro.
  const now = useNow(1000);
  const elapsed = formatDuration(now - new Date(trip.startedAt).getTime());
  const { gps, registerStop } = useTripTracking(trip.id, tracking);
  const [stopping, setStopping] = useState(false);
  const [stop, setStop] = useState<StopFeedback | null>(null);

  const handleStop = async () => {
    setStopping(true);
    const result = await registerStop();
    setStop('error' in result ? { ok: false, denied: result.error === 'denied' } : { ok: true, at: result.recordedAt });
    setStopping(false);
  };

  let hint: string;
  if (stop?.ok) hint = `Parada registrada às ${formatTime(stop.at)}. Use de novo a cada destino.`;
  else if (stop) hint = stop.denied ? 'GPS desligado: a parada não foi registrada.' : 'Não foi possível ler o GPS agora. Tente de novo.';
  else if (!online) hint = 'Sem conexão agora. O cronômetro continua contando.';
  else if (trip.tripType === 'abastecimento') hint = 'Ao devolver o carro, informe o KM do painel, o valor abastecido e assine.';
  else hint = 'Ao devolver o carro, informe o KM do painel e assine.';

  return (
    <main className="flex min-h-dvh flex-col bg-azul text-white">
      <header className="flex items-center justify-between px-5 pt-[max(16px,env(safe-area-inset-top))]">
        <div className="py-2">
          <LogoTexto height={24} />
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-verde/15 px-3.5 py-2 text-[13px] font-bold tracking-[0.4px] text-verde uppercase">
          <span className="size-2 animate-blink rounded-full bg-verde" />
          Em viagem
        </span>
      </header>

      <section className="flex flex-1 items-center justify-center py-8">
        <div className="relative flex size-[min(300px,78vw)] items-center justify-center">
          <span aria-hidden="true" className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-verde" />
          <span aria-hidden="true" className="absolute inset-0 rounded-full border-2 border-verde/40" />
          <span aria-hidden="true" className="absolute inset-5 rounded-full bg-white/[0.06]" />
          <div className="relative flex flex-col items-center gap-2">
            <span className="text-[13px] font-medium tracking-[0.6px] text-white/80 uppercase">Tempo de viagem</span>
            <span role="timer" aria-live="off" className="text-[clamp(40px,13vw,54px)] font-bold tracking-[-1px] tabular-nums">
              {elapsed}
            </span>
            <span className="text-[15px] text-white/80">Saída às {formatTime(trip.startedAt)}</span>
          </div>
        </div>
      </section>

      <m.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: 'easeOut' }}
        className="mx-5 flex flex-col rounded-[20px] bg-white/[0.08] px-[18px] py-1"
      >
        <InfoRow icon={<IconCar />} label="Veículo">
          <span className="font-bold">{trip.model}</span>
          <Plate plate={trip.plate} size="sm" onDark />
        </InfoRow>
        <InfoRow icon={<IconGauge />} label="KM inicial" divider>
          <span className="font-bold tabular-nums">{formatKm(trip.kmStart)} km</span>
        </InfoRow>
        {trip.tripType === 'abastecimento' && (
          <InfoRow icon={<IconFuel />} label="Tipo" divider>
            <span className="font-bold">Abastecimento</span>
          </InfoRow>
        )}
        {trip.destination && (
          <InfoRow icon={<IconPin />} label="Destino" divider>
            <span className="text-right font-bold">{trip.destination}</span>
          </InfoRow>
        )}
      </m.section>

      <footer className="flex flex-col gap-3 px-5 pt-5 pb-[max(28px,env(safe-area-inset-bottom))]">
        {tracking && gps === 'negado' && (
          <span className="flex items-center justify-center gap-2 text-[13px] text-laranja">
            <IconAlert size={16} />
            GPS desligado: a rota não será registrada.
          </span>
        )}
        {tracking && (
          <Button variant="onDark" onClick={handleStop} loading={stopping} loadingLabel="Registrando…" icon={<IconPin />}>
            Cheguei ao destino
          </Button>
        )}
        <Button variant="accent" onClick={onFinish} icon={<IconFlag />} className="h-[58px]">
          Finalizar viagem
        </Button>
        <span role="status" className="text-center text-[13px] text-white/80">
          {hint}
        </span>
      </footer>
    </main>
  );
}

function InfoRow({ icon, label, divider = false, children }: { icon: ReactNode; label: string; divider?: boolean; children: ReactNode }) {
  return (
    <div className={`flex items-center gap-3 py-3.5 ${divider ? 'border-t border-white/[0.12]' : ''}`}>
      <span className="flex text-verde">{icon}</span>
      <span className="flex-1 text-sm text-white/80">{label}</span>
      <span className="flex items-center gap-2 text-[15px]">{children}</span>
    </div>
  );
}

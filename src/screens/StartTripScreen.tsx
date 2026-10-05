import { useEffect, useState } from 'react';
import { m } from 'motion/react';
import { Button } from '../components/Button';
import { IconAlert, IconCheck, IconClock, IconGauge, IconLock, IconPin } from '../components/Icons';
import { Notice } from '../components/Notice';
import { Plate } from '../components/Plate';
import { Sheet } from '../components/Sheet';
import { TopBar } from '../components/TopBar';
import { parseConflict, toAppError, type Conflict, type FleetVehicle } from '../lib/api';
import { firstName, formatKm, formatTime } from '../lib/format';

type Props = {
  fleet: FleetVehicle[];
  online: boolean;
  onBack: () => void;
  onConfirm: (vehicle: FleetVehicle, destination: string) => Promise<void>;
  onConflict: () => void;
};

export function StartTripScreen({ fleet, online, onBack, onConfirm, onConflict }: Props) {
  const available = fleet.filter((v) => !v.inUse);
  const busyVehicles = fleet.filter((v) => v.inUse);
  const [pickedId, setPickedId] = useState<string | null>(available[0]?.id ?? null);
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<(Conflict & { vehicle: FleetVehicle }) | null>(null);

  // A lista atualiza sozinha; se o carro escolhido saiu, escolhe o primeiro livre.
  const picked = available.find((v) => v.id === pickedId) ?? null;
  useEffect(() => {
    if (!picked && available.length && !conflict) setPickedId(available[0].id);
  }, [picked, available, conflict]);

  const confirm = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(picked, destination);
    } catch (err) {
      const appError = toAppError(err);
      if (appError.code === 'VEHICLE_IN_USE') {
        setConflict({ ...parseConflict(appError), vehicle: picked });
        onConflict();
      } else {
        setError(appError.message);
      }
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <TopBar title="Iniciar viagem" onBack={onBack} />

      <div className="flex flex-1 flex-col gap-[22px] px-5 pt-2 pb-5">
        <section className="flex flex-col gap-2.5">
          <h2 className="text-base font-bold">1. Escolha o carro</h2>
          {available.length === 0 && <Notice tone="warning">Nenhum carro disponível agora.</Notice>}
          <div role="radiogroup" aria-label="Carros disponíveis" className="flex flex-col gap-2.5">
            {available.map((v) => {
              const selected = v.id === picked?.id;
              return (
                <m.button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPickedId(v.id)}
                  whileTap={{ scale: 0.98 }}
                  className={`flex w-full items-center gap-3.5 rounded-2xl border-2 px-3.5 py-3 text-left transition-colors ${
                    selected ? 'border-azul bg-verde/10' : 'border-cinza bg-white'
                  }`}
                >
                  <Plate plate={v.plate} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-base leading-snug font-bold">{v.model}</span>
                    <span className="text-sm text-azul/80 tabular-nums">{formatKm(v.currentKm)} km</span>
                  </span>
                  {selected ? (
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-verde">
                      <IconCheck size={16} strokeWidth={3} />
                    </span>
                  ) : (
                    <span className="size-7 shrink-0 rounded-full border-2 border-cinza" />
                  )}
                </m.button>
              );
            })}
          </div>
          {busyVehicles.map((v) => (
            <div key={v.id} aria-disabled="true" className="flex items-center gap-3.5 rounded-2xl border-2 border-dashed border-cinza px-3.5 py-3">
              <Plate plate={v.plate} muted />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base leading-snug font-bold">{v.model}</span>
                <span className="text-sm text-azul/80">
                  Com {v.isMine ? 'você' : firstName(v.driverName ?? '—')}
                  {v.tripStartedAt ? ` desde ${formatTime(v.tripStartedAt)}` : ''}
                </span>
              </div>
              <span className="rounded-full bg-laranja px-2.5 py-1.5 text-[13px] font-bold">Em uso</span>
            </div>
          ))}
        </section>

        {picked && (
          <section className="flex flex-col gap-2.5">
            <h2 className="text-base font-bold">2. Confira o KM inicial</h2>
            <div className="flex items-center gap-3.5 rounded-2xl bg-cinza/55 px-4 py-3.5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white">
                <IconGauge size={22} />
              </span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-medium">KM inicial registrado</span>
                <span className="text-[28px] font-bold tabular-nums">{formatKm(picked.currentKm)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
                <IconLock size={14} strokeWidth={2.4} />
                Automático
              </span>
            </div>
            <p className="text-[13px] leading-[1.45] text-azul/80">Vem do último retorno deste carro. Não precisa digitar.</p>
          </section>
        )}

        <section className="flex flex-col gap-2.5">
          <label htmlFor="destino" className="text-base font-bold">
            3. Destino ou motivo <span className="font-normal text-azul/80">(opcional)</span>
          </label>
          <div className="relative flex items-center">
            <IconPin className="pointer-events-none absolute left-4 text-azul/60" />
            <input
              id="destino"
              type="text"
              maxLength={200}
              enterKeyHint="done"
              placeholder="Ex.: entrega de documentos"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="h-[54px] w-full rounded-[14px] border-[1.5px] border-cinza bg-white pr-4 pl-12 text-base outline-none transition-[border-color,box-shadow] focus:border-azul focus:shadow-[0_0_0_3px_rgb(50_208_176/0.35)]"
            />
          </div>
        </section>

        {error && <Notice tone="error">{error}</Notice>}
        {!online && <Notice tone="warning">Sem conexão. A saída só pode ser registrada com internet.</Notice>}
      </div>

      <footer className="sticky bottom-0 flex flex-col gap-2.5 border-t border-cinza bg-white px-5 pt-3 pb-[max(24px,env(safe-area-inset-bottom))]">
        <Button onClick={confirm} disabled={!picked || !online} loading={busy} loadingLabel="Registrando saída…" icon={<IconClock />}>
          Iniciar viagem
        </Button>
        <span className="text-center text-[13px] text-azul/80">O cronômetro começa quando você confirmar.</span>
      </footer>

      <Sheet
        open={conflict !== null}
        onClose={() => setConflict(null)}
        title="Este carro acabou de sair"
        icon={
          <span className="flex size-14 items-center justify-center rounded-2xl bg-laranja">
            <IconAlert size={26} />
          </span>
        }
      >
        {conflict && (
          <p className="text-base leading-normal text-azul/85">
            {conflict.driver ? firstName(conflict.driver) : 'Outro condutor'} iniciou uma viagem com o {conflict.vehicle.model} ({conflict.vehicle.plate})
            {conflict.startedAt ? ` às ${formatTime(conflict.startedAt)}` : ''}, enquanto você preenchia. A lista já foi atualizada.
          </p>
        )}
        <Button onClick={() => setConflict(null)} className="mt-1">
          Escolher outro carro
        </Button>
      </Sheet>
    </main>
  );
}

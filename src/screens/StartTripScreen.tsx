import { useEffect, useState, type ReactNode } from 'react';
import { m } from 'motion/react';
import { Button } from '../components/Button';
import { IconAlert, IconCar, IconCheck, IconClock, IconFuel, IconGauge, IconInfo, IconLock, IconPin } from '../components/Icons';
import { Notice } from '../components/Notice';
import { Plate } from '../components/Plate';
import { VehicleDriver } from '../components/VehicleDriver';
import { VehicleThumb } from '../components/VehicleThumb';
import { Sheet } from '../components/Sheet';
import { TopBar } from '../components/TopBar';
import { parseConflict, toAppError, type Conflict, type FleetVehicle, type TripType } from '../lib/api';
import { firstName, formatKm, formatTime } from '../lib/format';

type Props = {
  fleet: FleetVehicle[];
  online: boolean;
  onBack: () => void;
  onConfirm: (vehicle: FleetVehicle, destination: string, tripType: TripType) => Promise<void>;
  onConflict: () => void;
};

export function StartTripScreen({ fleet, online, onBack, onConfirm, onConflict }: Props) {
  const available = fleet.filter((v) => !v.inUse);
  const busyVehicles = fleet.filter((v) => v.inUse);
  const [pickedId, setPickedId] = useState<string | null>(available[0]?.id ?? null);
  const [tripType, setTripType] = useState<TripType>('normal');
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
      await onConfirm(picked, destination, tripType);
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
                  <VehicleThumb imageUrl={v.imageUrl} model={v.model} plate={v.plate} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-base leading-snug font-bold">{v.model}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-azul/80 tabular-nums">
                      {v.imageUrl && <Plate plate={v.plate} size="sm" />}
                      {formatKm(v.currentKm)} km
                    </span>
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
            <div key={v.id} aria-disabled="true" className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-cinza px-3.5 py-3">
              <div className="flex items-center gap-3.5">
                <VehicleThumb imageUrl={v.imageUrl} model={v.model} plate={v.plate} muted />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-base leading-snug font-bold">{v.model}</span>
                  {v.imageUrl && (
                    <span className="self-start">
                      <Plate plate={v.plate} size="sm" muted />
                    </span>
                  )}
                </div>
                <span className="rounded-full bg-laranja px-2.5 py-1.5 text-[13px] font-bold">Em uso</span>
              </div>
              <VehicleDriver vehicle={v} />
            </div>
          ))}
        </section>

        {picked && (
          <section className="flex flex-col gap-2.5">
            <h2 id="tipo-label" className="text-base font-bold">
              2. Tipo de viagem
            </h2>
            <div role="radiogroup" aria-labelledby="tipo-label" className="grid grid-cols-2 gap-2.5">
              <TripTypeOption
                selected={tripType === 'normal'}
                onSelect={() => setTripType('normal')}
                icon={<IconCar size={24} />}
                iconBg="bg-azul-claro/35"
                title="Viagem normal"
                description="Serviço, entrega ou visita"
              />
              <TripTypeOption
                selected={tripType === 'abastecimento'}
                onSelect={() => setTripType('abastecimento')}
                icon={<IconFuel size={24} />}
                iconBg="bg-laranja/35"
                title="Abastecimento"
                description="Ir ao posto ou recarregar"
              />
            </div>
            {tripType === 'abastecimento' ? (
              <div className="flex items-start gap-2.5 rounded-[14px] bg-laranja/20 px-3.5 py-3 text-sm leading-[1.45]">
                <IconInfo size={18} strokeWidth={2.2} className="mt-px shrink-0" />
                <span>
                  No retorno, você vai informar <strong>o que abasteceu e o valor</strong>. Guarde o comprovante.
                </span>
              </div>
            ) : (
              <p className="text-[13px] leading-[1.45] text-azul/80">Se abastecer no caminho, dá para informar o valor no retorno.</p>
            )}
          </section>
        )}

        {picked && (
          <section className="flex flex-col gap-2.5">
            <h2 className="text-base font-bold">3. Confira o KM inicial</h2>
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
            4. Destino ou motivo <span className="font-normal text-azul/80">(opcional)</span>
          </label>
          <div className="relative flex items-center">
            <IconPin className="pointer-events-none absolute left-4 text-azul/60" />
            <input
              id="destino"
              type="text"
              maxLength={200}
              enterKeyHint="done"
              placeholder={tripType === 'abastecimento' ? 'Ex.: posto ou eletroposto' : 'Ex.: entrega de documentos'}
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

function TripTypeOption({ selected, onSelect, icon, iconBg, title, description }: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  iconBg: string;
  title: string;
  description: string;
}) {
  return (
    <m.button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
      className={`relative flex min-h-32 flex-col items-start gap-2.5 rounded-2xl border-2 p-3.5 text-left transition-colors ${
        selected ? 'border-azul bg-verde/10' : 'border-cinza bg-white'
      }`}
    >
      <span className={`flex size-11 items-center justify-center rounded-xl ${iconBg}`}>{icon}</span>
      <span className="flex flex-col gap-0.5">
        <span className="text-base font-bold">{title}</span>
        <span className="text-[13px] leading-[1.35] text-azul/80">{description}</span>
      </span>
      {selected && (
        <span className="absolute top-3 right-3 flex size-6 items-center justify-center rounded-full bg-verde">
          <IconCheck size={14} strokeWidth={3} />
        </span>
      )}
    </m.button>
  );
}

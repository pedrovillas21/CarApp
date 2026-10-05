import { m } from 'motion/react';
import type { Driver } from '../auth/AuthProvider';
import { Spinner } from '../components/Button';
import { IconArrowRight, IconLogout, IconRefresh, IconWifiOff } from '../components/Icons';
import { LogoTexto } from '../components/Logo';
import { Notice } from '../components/Notice';
import { Plate } from '../components/Plate';
import { VehicleThumb } from '../components/VehicleThumb';
import type { AppError, FleetVehicle } from '../lib/api';
import { firstName, formatKm, formatTime, initials, todayLabel } from '../lib/format';

type Props = {
  driver: Driver;
  fleet: { data: FleetVehicle[] | null; error: AppError | null; loading: boolean; reload: () => void };
  online: boolean;
  onStart: () => void;
  onSignOut: () => void;
};

export function HomeScreen({ driver, fleet, online, onStart, onSignOut }: Props) {
  const vehicles = fleet.data ?? [];
  const available = vehicles.filter((v) => !v.inUse).length;
  const canStart = online && available > 0;

  return (
    <main className="flex min-h-dvh flex-col">
      {!online && <OfflineBanner onRetry={fleet.reload} />}

      <header className="flex flex-col gap-7 rounded-b-[28px] bg-azul px-5 pt-[max(16px,env(safe-area-inset-top))] pb-[84px]">
        <div className="flex items-center justify-between">
          <div className="py-2">
            <LogoTexto height={24} />
          </div>
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sair"
            className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-white"
          >
            <IconLogout />
          </button>
        </div>
        <div className="flex items-center gap-3.5">
          <span aria-hidden="true" className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-verde text-lg font-bold text-azul">
            {initials(driver.fullName)}
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[26px] font-bold text-white">Olá, {firstName(driver.fullName)}</span>
            <span className="text-[15px] text-white/80">{todayLabel()}</span>
          </div>
        </div>
      </header>

      {canStart ? (
        <m.button
          type="button"
          onClick={onStart}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, ease: 'easeOut' }}
          className="mx-5 -mt-14 flex items-center gap-4 rounded-[20px] bg-verde p-5 text-left text-azul shadow-[0_12px_28px_rgb(46_47_113/0.2)]"
        >
          <span className="flex flex-1 flex-col gap-1">
            <span className="text-[22px] font-bold">Iniciar viagem</span>
            <span className="text-[15px] leading-[1.4]">Escolha o carro e registre a saída</span>
          </span>
          <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-azul text-white">
            <IconArrowRight size={22} />
          </span>
        </m.button>
      ) : (
        <div aria-disabled="true" className="mx-5 -mt-14 flex items-center gap-4 rounded-[20px] bg-cinza p-5 text-azul/75">
          <span className="flex flex-1 flex-col gap-1">
            <span className="text-[22px] font-bold">Iniciar viagem</span>
            <span className="text-[15px] leading-[1.4]">
              {!online ? 'Disponível quando a conexão voltar' : fleet.data === null ? 'Carregando a frota…' : 'Nenhum carro disponível agora'}
            </span>
          </span>
          <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-azul/10">
            {!online ? <IconWifiOff size={22} /> : <IconArrowRight size={22} />}
          </span>
        </div>
      )}

      <section className="flex flex-1 flex-col gap-3 px-5 pt-7 pb-[max(24px,env(safe-area-inset-bottom))]">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">Frota</h2>
          {fleet.data && (
            <span className="text-sm text-azul/80">
              {available} de {vehicles.length} disponíve{vehicles.length === 1 ? 'l' : 'is'}
            </span>
          )}
        </div>

        {fleet.error && fleet.data && online && (
          <Notice tone="warning">Não foi possível atualizar a frota. Mostrando a última lista.</Notice>
        )}

        {fleet.data === null ? (
          fleet.error ? (
            <Notice
              tone="error"
              action={
                <button type="button" onClick={fleet.reload} className="-my-1 shrink-0 font-bold underline underline-offset-2">
                  Tentar de novo
                </button>
              }
            >
              {fleet.error.message}
            </Notice>
          ) : (
            <FleetSkeleton />
          )
        ) : vehicles.length === 0 ? (
          <p className="rounded-2xl border border-cinza p-4 text-[15px] leading-normal">
            Nenhum veículo cadastrado. Peça à administração para cadastrar a frota.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {vehicles.map((v) => (
              <li key={v.id} className="flex items-center gap-3.5 rounded-2xl border border-cinza bg-white px-4 py-3.5">
                <VehicleThumb imageUrl={v.imageUrl} model={v.model} plate={v.plate} />
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="text-base leading-snug font-bold">{v.model}</span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-azul/80 tabular-nums">
                      {v.imageUrl && <Plate plate={v.plate} size="sm" />}
                      {formatKm(v.currentKm)} km
                    </span>
                </div>
                {v.inUse ? (
                  <span className="flex flex-col items-end gap-1">
                    <span className="rounded-full bg-laranja px-2.5 py-1.5 text-[13px] font-bold">Em uso</span>
                    <span className="text-xs text-azul/80">
                      {v.isMine ? 'Você' : firstName(v.driverName ?? '—')}
                      {v.tripStartedAt ? ` · ${formatTime(v.tripStartedAt)}` : ''}
                    </span>
                  </span>
                ) : (
                  <span className="rounded-full bg-verde px-2.5 py-1.5 text-[13px] font-bold">Disponível</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function OfflineBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="status" className="flex items-center gap-3 bg-laranja px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3">
      <IconWifiOff size={22} className="shrink-0" />
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-bold">Sem conexão</span>
        <span className="text-[13px] leading-[1.4]">Saída e retorno precisam de internet.</span>
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="flex h-11 items-center gap-1.5 rounded-xl border-[1.5px] border-azul px-3.5 text-sm font-bold"
      >
        <IconRefresh size={16} strokeWidth={2.2} />
        Tentar
      </button>
    </div>
  );
}

function FleetSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Carregando a frota">
      <span className="flex items-center gap-2.5 text-sm text-azul/80">
        <Spinner className="size-4" />
        Carregando a frota…
      </span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-cinza px-4 py-3.5">
          <span className="h-[38px] w-[88px] animate-skeleton rounded-[7px] bg-cinza" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3.5 w-[120px] animate-skeleton rounded-md bg-cinza" />
            <span className="h-3 w-20 animate-skeleton rounded-md bg-cinza" />
          </span>
          <span className="h-7 w-[84px] animate-skeleton rounded-full bg-cinza" />
        </div>
      ))}
    </div>
  );
}

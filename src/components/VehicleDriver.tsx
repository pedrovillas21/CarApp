import { useNow } from '../hooks/useNow';
import type { FleetVehicle } from '../lib/api';
import { formatElapsed, formatTime, initials } from '../lib/format';
import { IconClock } from './Icons';

/** Quem está com o carro em uso, em destaque, para os colegas saberem com quem falar. */
export function VehicleDriver({ vehicle }: { vehicle: FleetVehicle }) {
  const now = useNow(60_000);
  const name = vehicle.isMine ? 'Você' : vehicle.driverName?.trim() || 'Outro condutor';

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-laranja/20 p-3">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-laranja text-[15px] font-bold">
          {vehicle.driverName ? initials(vehicle.driverName) : '?'}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-xs font-medium tracking-[0.4px] text-azul/80 uppercase">Com</span>
          <span className="text-base leading-tight font-bold break-words">{name}</span>
        </span>
      </div>
      {vehicle.tripStartedAt && (
        <span className="flex items-center gap-2 text-sm tabular-nums">
          <IconClock size={16} strokeWidth={2.2} className="shrink-0" />
          Saiu às {formatTime(vehicle.tripStartedAt)} · {formatElapsed(now - new Date(vehicle.tripStartedAt).getTime())}
        </span>
      )}
    </div>
  );
}

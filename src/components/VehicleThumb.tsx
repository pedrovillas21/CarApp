import { useState } from 'react';
import { Plate } from './Plate';

/** Foto do modelo (estilo app de corrida). Sem foto, ou se ela falhar, mostra a placa. */
export function VehicleThumb({ imageUrl, model, plate, muted = false }: {
  imageUrl: string | null;
  model: string;
  plate: string;
  muted?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!imageUrl || failed) return <Plate plate={plate} muted={muted} />;
  return (
    <span className={`flex h-[52px] w-[96px] shrink-0 items-center justify-center overflow-hidden ${muted ? 'opacity-55' : ''}`}>
      <img
        src={imageUrl}
        alt={model}
        loading="lazy"
        draggable={false}
        onError={() => setFailed(true)}
        className="size-full object-contain"
      />
    </span>
  );
}

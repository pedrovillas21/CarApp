/** Placa no padrão Mercosul (faixa azul em cima). */
export function Plate({ plate, size = 'md', muted = false, onDark = false }: {
  plate: string;
  size?: 'sm' | 'md';
  muted?: boolean;
  onDark?: boolean;
}) {
  const border = muted ? 'border-azul/45' : onDark ? 'border-white' : 'border-azul';
  const band = muted ? 'bg-azul/45' : 'bg-azul';
  const text = muted ? 'text-azul/60' : 'text-azul';

  if (size === 'sm') {
    return (
      <span className={`inline-flex shrink-0 flex-col overflow-hidden rounded-md border-[1.5px] bg-white ${border}`}>
        <span className={`h-[5px] ${band}`} />
        <span className={`px-[7px] pt-0.5 pb-[3px] text-xs font-bold tracking-[0.8px] ${text}`}>{plate}</span>
      </span>
    );
  }
  return (
    <span className={`flex w-[88px] shrink-0 flex-col overflow-hidden rounded-[7px] border-[1.5px] bg-white ${border}`}>
      <span className={`h-2 ${band}`} />
      <span className={`pt-[5px] pb-1.5 text-center text-[15px] font-bold tracking-[1px] ${text}`}>{plate}</span>
    </span>
  );
}

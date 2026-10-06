import { useRef, useState } from 'react';
import { Button } from '../components/Button';
import { IconCheck, IconRotate } from '../components/Icons';
import { Notice } from '../components/Notice';
import { Plate } from '../components/Plate';
import { SignaturePad, type SignaturePadHandle } from '../components/SignaturePad';
import { Steps, TopBar } from '../components/TopBar';
import { toAppError, type OpenTrip, type Refuel } from '../lib/api';
import { describeRefuel, formatKm } from '../lib/format';

export function SignatureScreen({ trip, kmEnd, refuel, driverName, online, onBack, onConfirm }: {
  trip: OpenTrip;
  kmEnd: number;
  refuel: Refuel | null;
  driverName: string;
  online: boolean;
  onBack: () => void;
  onConfirm: (signature: Blob) => Promise<void>;
}) {
  const padRef = useRef<SignaturePadHandle>(null);
  const [empty, setEmpty] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(await pad.toBlob());
    } catch (err) {
      setError(toAppError(err).message);
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <TopBar title="Assinatura" onBack={onBack} right={<Plate plate={trip.plate} size="sm" />} />
      <Steps current={3} />

      <section className="flex flex-col gap-3.5 px-5 pt-[18px]">
        <dl className="flex flex-col rounded-2xl border border-cinza px-4 py-1">
          <span className="pt-3 pb-1 text-[13px] font-medium text-azul/80">Você confirma a devolução de:</span>
          <SummaryRow label="Veículo" value={`${trip.model} · ${trip.plate}`} />
          <SummaryRow label="Quilometragem" value={`${formatKm(trip.kmStart)} → ${formatKm(kmEnd)} km`} />
          <SummaryRow label="Abastecimento" value={describeRefuel(refuel)} />
          <SummaryRow label="Condutor" value={driverName} last />
        </dl>

        <div className="relative h-[clamp(200px,34dvh,280px)] overflow-hidden rounded-[20px] border-2 border-dashed border-azul/30 bg-white">
          <span aria-hidden="true" className="pointer-events-none absolute right-6 bottom-[62px] left-6 h-0.5 bg-cinza" />
          <span aria-hidden="true" className="pointer-events-none absolute bottom-[68px] left-7 text-lg leading-none font-bold text-azul/45">
            ×
          </span>
          {empty && (
            <span className="pointer-events-none absolute right-0 bottom-[30px] left-0 text-center text-sm text-azul/80">Assine aqui com o dedo</span>
          )}
          <SignaturePad ref={padRef} onChange={setEmpty} />
          <button
            type="button"
            onClick={() => padRef.current?.clear()}
            disabled={empty || busy}
            className="absolute top-2 right-2 z-10 flex h-11 items-center gap-1.5 rounded-xl bg-cinza/60 px-3.5 text-sm font-bold disabled:opacity-0"
          >
            <IconRotate size={16} strokeWidth={2.2} />
            Limpar
          </button>
        </div>

        <p className="text-[13px] leading-[1.45] text-azul/80">
          Ao assinar, confirmo que devolvi o veículo com a quilometragem{refuel ? ' e o abastecimento informados' : ' informada'}.
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        {!online && !error && <Notice tone="warning">Sem conexão. Para concluir o retorno, conecte-se à internet.</Notice>}
      </section>

      <footer className="mt-auto px-5 pt-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        <Button onClick={confirm} disabled={empty || !online} loading={busy} loadingLabel="Enviando…" icon={<IconCheck />}>
          Confirmar e assinar
        </Button>
      </footer>
    </main>
  );
}

function SummaryRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-2.5 text-[15px] ${last ? 'pb-3' : 'border-b border-cinza'}`}>
      <dt className="text-azul/80">{label}</dt>
      <dd className="text-right font-bold tabular-nums">{value}</dd>
    </div>
  );
}

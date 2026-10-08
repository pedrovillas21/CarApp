import { useState, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { IconClock, IconEye, IconFlag, IconPin, IconShield } from '../components/Icons';
import { Notice } from '../components/Notice';
import { TopBar } from '../components/TopBar';
import { toAppError } from '../lib/api';

/** Aviso mostrado uma única vez, antes da primeira viagem: o que é registrado, quando, quem vê e por quanto tempo. */
export function LocationConsentScreen({ onBack, onAccept }: { onBack: () => void; onAccept: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await onAccept();
    } catch (err) {
      setError(toAppError(err).message);
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <TopBar title="Localização na viagem" onBack={onBack} />

      <div className="flex flex-1 flex-col gap-5 px-5 pt-3 pb-5">
        <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-full bg-verde/20">
          <IconPin size={30} />
        </span>
        <p className="text-base leading-normal">
          Para conferir a quilometragem, o app registra o trajeto de cada viagem pelo GPS do celular.
        </p>

        <ul className="flex flex-col rounded-2xl bg-cinza/55 px-[18px] py-1">
          <Item icon={<IconClock />}>
            O GPS só é lido <strong>durante a viagem e com o app aberto</strong>. Fora da viagem, nada é registrado.
          </Item>
          <Item icon={<IconFlag />} divider>
            São registrados a saída, cada destino (botão <strong>Cheguei ao destino</strong>), o retorno e pontos do caminho
            enquanto o app estiver aberto.
          </Item>
          <Item icon={<IconEye />} divider>
            Só a <strong>administração</strong> vê esses dados.
          </Item>
          <Item icon={<IconShield />} divider>
            Os pontos são apagados depois de <strong>12 meses</strong>.
          </Item>
        </ul>

        <p className="text-sm leading-normal text-azul/80">
          Se você não permitir o GPS, a viagem funciona normalmente. Ela só fica sem o registro do trajeto.
        </p>

        {error && <Notice tone="error">{error}</Notice>}
      </div>

      <footer className="px-5 pt-2 pb-[max(24px,env(safe-area-inset-bottom))]">
        <Button onClick={accept} loading={busy}>
          Entendi
        </Button>
      </footer>
    </main>
  );
}

function Item({ icon, divider = false, children }: { icon: ReactNode; divider?: boolean; children: ReactNode }) {
  return (
    <li className={`flex items-start gap-3 py-[13px] text-[15px] leading-[1.45] ${divider ? 'border-t border-cinza' : ''}`}>
      <span className="mt-px flex shrink-0">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

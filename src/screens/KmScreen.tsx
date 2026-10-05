import { useCallback, useEffect, useRef, useState } from 'react';
import { m } from 'motion/react';
import { Button } from '../components/Button';
import { IconArrowRight, IconBackspace } from '../components/Icons';
import { Notice } from '../components/Notice';
import { Plate } from '../components/Plate';
import { Steps, TopBar } from '../components/TopBar';
import type { OpenTrip } from '../lib/api';
import { KM_MAX_DIFF, KM_MAX_DIGITS, KM_WARN_DIFF } from '../lib/constants';
import { formatKm } from '../lib/format';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const;
type Key = (typeof KEYS)[number];

export function KmScreen({ trip, initialKm, onBack, onContinue }: {
  trip: OpenTrip;
  initialKm: number | null;
  onBack: () => void;
  onContinue: (km: number) => void;
}) {
  // Campo começa vazio: o condutor digita direto, sem apagar nada antes.
  const [digits, setDigits] = useState(initialKm === null ? '' : String(initialKm));

  const isEmpty = digits === '';
  const km = isEmpty ? 0 : Number.parseInt(digits, 10);
  const diff = km - trip.kmStart;
  const tooLow = !isEmpty && diff < 0;
  const tooHigh = !isEmpty && diff > KM_MAX_DIFF;
  const warn = !isEmpty && !tooHigh && diff > KM_WARN_DIFF;
  const valid = !isEmpty && !tooLow && !tooHigh;

  const press = useCallback((key: Key) => {
    setDigits((current) => {
      if (key === 'clear') return '';
      if (key === 'back') return current.slice(0, -1);
      if (current.length >= KM_MAX_DIGITS) return current;
      return (current + key).replace(/^0+(?=\d)/, '');
    });
  }, []);

  // Teclado físico também funciona (útil no computador).
  const submitRef = useRef<() => void>(() => {});
  submitRef.current = () => {
    if (valid) onContinue(km);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^\d$/.test(e.key)) press(e.key as Key);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Delete' || e.key === 'Escape') press('clear');
      else if (e.key === 'Enter') submitRef.current();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  return (
    <main className="flex min-h-dvh flex-col">
      <TopBar title="Retorno do veículo" onBack={onBack} right={<Plate plate={trip.plate} size="sm" />} />
      <Steps current={1} />

      <section className="flex flex-col gap-3 px-5 pt-5">
        <div className={`flex flex-col gap-2.5 rounded-[20px] border-2 px-5 py-[18px] ${tooLow || tooHigh ? 'border-coral' : 'border-azul'}`}>
          <span id="km-label" className="text-sm font-medium">
            KM final no painel
          </span>
          <div className="flex min-h-[52px] items-center gap-1.5">
            <output aria-labelledby="km-label" aria-live="polite" className="text-[44px] font-bold tracking-[-0.5px] tabular-nums">
              {isEmpty ? '' : formatKm(km)}
            </output>
            <span aria-hidden="true" className="h-[38px] w-[3px] animate-caret rounded-sm bg-verde" />
            <span className="ml-auto text-lg font-medium text-azul/80">km</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-cinza/70 px-2.5 py-1.5 text-[13px] font-medium tabular-nums">Inicial {formatKm(trip.kmStart)}</span>
            {valid && (
              <m.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15 }}
                className="rounded-full bg-verde px-2.5 py-1.5 text-[13px] font-bold tabular-nums"
              >
                +{formatKm(diff)} km rodados
              </m.span>
            )}
          </div>
        </div>

        {isEmpty && <p className="text-sm text-azul/80">Digite o número que aparece no hodômetro.</p>}
        {tooLow && (
          <Notice tone="error">
            O KM final não pode ser menor que o inicial ({formatKm(trip.kmStart)}). Confira o painel.
          </Notice>
        )}
        {tooHigh && <Notice tone="error">Mais de {formatKm(KM_MAX_DIFF)} km rodados? Confira o hodômetro: parece ter um dígito a mais.</Notice>}
        {warn && <Notice tone="warning">{formatKm(diff)} km rodados é um valor alto. Confira antes de continuar.</Notice>}
      </section>

      <div className="mt-auto grid grid-cols-3 gap-2.5 px-5 pt-4" role="group" aria-label="Teclado numérico">
        {KEYS.map((key) => (
          <m.button
            key={key}
            type="button"
            onClick={() => press(key)}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.12 }}
            aria-label={key === 'back' ? 'Apagar último dígito' : key === 'clear' ? 'Limpar tudo' : undefined}
            className={`flex h-[60px] items-center justify-center rounded-[14px] bg-cinza/60 font-bold ${key === 'clear' ? 'text-[17px]' : 'text-[26px]'}`}
          >
            {key === 'back' ? <IconBackspace /> : key === 'clear' ? 'Limpar' : key}
          </m.button>
        ))}
      </div>

      <footer className="px-5 pt-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        <Button disabled={!valid} onClick={() => onContinue(km)}>
          <span className="inline-flex items-center gap-2.5">
            Continuar para assinatura <IconArrowRight />
          </span>
        </Button>
      </footer>
    </main>
  );
}

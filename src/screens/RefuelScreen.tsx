import { useState, type ReactNode } from 'react';
import { m } from 'motion/react';
import { Button } from '../components/Button';
import { IconArrowRight, IconBolt, IconCar, IconFuel } from '../components/Icons';
import { Notice } from '../components/Notice';
import { Plate } from '../components/Plate';
import { Steps, TopBar } from '../components/TopBar';
import type { FuelType, OpenTrip, Refuel } from '../lib/api';
import { FUEL_MAX_AMOUNT } from '../lib/constants';
import { formatMoney } from '../lib/format';

const OPTIONS: { value: FuelType; label: string; icon: ReactNode }[] = [
  { value: 'gasolina', label: 'Gasolina', icon: <IconFuel size={24} /> },
  { value: 'eletricidade', label: 'Eletricidade', icon: <IconBolt size={24} /> },
  {
    value: 'ambos',
    label: 'Os dois',
    icon: (
      <span className="flex items-center gap-0.5">
        <IconFuel size={20} strokeWidth={2.2} />
        <IconBolt size={20} strokeWidth={2.2} />
      </span>
    ),
  },
];

/** Valor guardado em centavos (só dígitos): o condutor digita 15000 e vê 150,00. */
const toCents = (amount: number | null | undefined) => (amount ? String(Math.round(amount * 100)) : '');
const fromCents = (cents: string) => (cents ? Number(cents) / 100 : 0);

/**
 * Retorno, etapa 2: o que foi abastecido e quanto custou.
 * Obrigatório na viagem de abastecimento; opcional na normal (sem nada marcado, segue sem abastecimento).
 */
export function RefuelScreen({ trip, initial, onBack, onContinue }: {
  trip: OpenTrip;
  initial: Refuel | null | undefined;
  onBack: () => void;
  onContinue: (refuel: Refuel | null) => void;
}) {
  const required = trip.tripType === 'abastecimento';
  const [fuelType, setFuelType] = useState<FuelType | null>(initial?.fuelType ?? null);
  const [gasCents, setGasCents] = useState(toCents(initial?.gasolineAmount));
  const [eleCents, setEleCents] = useState(toCents(initial?.electricAmount));

  const needsGas = fuelType === 'gasolina' || fuelType === 'ambos';
  const needsEle = fuelType === 'eletricidade' || fuelType === 'ambos';
  const gas = fromCents(gasCents);
  const ele = fromCents(eleCents);
  const gasTooHigh = needsGas && gas > FUEL_MAX_AMOUNT;
  const eleTooHigh = needsEle && ele > FUEL_MAX_AMOUNT;
  const amountsOk = (!needsGas || (gas > 0 && !gasTooHigh)) && (!needsEle || (ele > 0 && !eleTooHigh));
  const valid = fuelType ? amountsOk : !required;

  // Na viagem normal, tocar de novo desmarca (não abasteceu).
  const pick = (value: FuelType) => setFuelType((current) => (current === value && !required ? null : value));

  const submit = () => {
    if (!valid) return;
    onContinue(
      fuelType ? { fuelType, gasolineAmount: needsGas ? gas : null, electricAmount: needsEle ? ele : null } : null,
    );
  };

  let hint: string | null = null;
  if (!fuelType) hint = required ? 'Obrigatório nesta viagem: escolha o que abasteceu e informe o valor do comprovante.' : 'Se não abasteceu, é só continuar.';
  else if (!required) hint = 'Toque de novo para desmarcar, se não abasteceu.';

  return (
    <main className="flex min-h-dvh flex-col">
      <TopBar title="Retorno do veículo" onBack={onBack} right={<Plate plate={trip.plate} size="sm" />} />
      <Steps current={2} />

      <section className="flex flex-col gap-[22px] px-5 pt-[22px]">
        {required ? (
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-laranja/35 py-[7px] pr-3 pl-2.5 text-[13px] font-bold">
            <IconFuel size={16} strokeWidth={2.2} />
            Viagem de abastecimento
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-azul-claro/35 py-[7px] pr-3 pl-2.5 text-[13px] font-bold">
            <IconCar size={16} strokeWidth={2.2} />
            Viagem normal
          </span>
        )}

        <div className="flex flex-col gap-2.5">
          <h2 id="fuel-label" className="text-base font-bold">
            {required ? (
              'O que você abasteceu?'
            ) : (
              <>
                Abasteceu nesta viagem? <span className="font-normal text-azul/80">(opcional)</span>
              </>
            )}
          </h2>
          <div role="radiogroup" aria-labelledby="fuel-label" aria-required={required} className="grid grid-cols-3 gap-2">
            {OPTIONS.map((option) => {
              const selected = option.value === fuelType;
              return (
                <m.button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => pick(option.value)}
                  whileTap={{ scale: 0.97 }}
                  className={`flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-[14px] border-2 px-1.5 py-2.5 text-sm font-bold transition-colors ${
                    selected ? 'border-azul bg-verde/10' : 'border-cinza bg-white'
                  }`}
                >
                  {option.icon}
                  {option.label}
                </m.button>
              );
            })}
          </div>
          {hint && <p className="text-[13px] leading-[1.45] text-azul/80">{hint}</p>}
        </div>

        {needsGas && <MoneyField id="valor-gasolina" label="Valor da gasolina" cents={gasCents} onChange={setGasCents} invalid={gasTooHigh} />}
        {needsEle && (
          <MoneyField id="valor-eletricidade" label="Valor da recarga elétrica" cents={eleCents} onChange={setEleCents} invalid={eleTooHigh} />
        )}

        {(gasTooHigh || eleTooHigh) && (
          <Notice tone="error">Valor acima de {formatMoney(FUEL_MAX_AMOUNT)}. Confira o comprovante: parece ter um dígito a mais.</Notice>
        )}

        {fuelType === 'ambos' && gas > 0 && ele > 0 && (
          <div className="flex items-center justify-between rounded-[14px] bg-cinza/55 px-4 py-3.5">
            <span className="text-sm font-medium">Total abastecido</span>
            <span className="text-xl font-bold tabular-nums">{formatMoney(gas + ele)}</span>
          </div>
        )}
      </section>

      <footer className="mt-auto px-5 pt-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        <Button disabled={!valid} onClick={submit}>
          <span className="inline-flex items-center gap-2.5">
            {fuelType || required ? 'Continuar para assinatura' : 'Continuar sem abastecimento'} <IconArrowRight />
          </span>
        </Button>
      </footer>
    </main>
  );
}

function MoneyField({ id, label, cents, onChange, invalid }: {
  id: string;
  label: string;
  cents: string;
  onChange: (cents: string) => void;
  invalid: boolean;
}) {
  const shown = cents ? fromCents(cents).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-bold">
        {label}
      </label>
      <div
        className={`flex h-[60px] items-center gap-2 rounded-[14px] border-2 bg-white px-4 transition-[border-color,box-shadow] focus-within:shadow-[0_0_0_3px_rgb(50_208_176/0.35)] ${
          invalid ? 'border-coral' : 'border-azul'
        }`}
      >
        <span aria-hidden="true" className="text-lg font-medium text-azul/80">
          R$
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="done"
          placeholder="0,00"
          aria-invalid={invalid || undefined}
          value={shown}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 7))}
          className="h-full min-w-0 flex-1 bg-transparent text-[26px] font-bold tabular-nums outline-none"
        />
      </div>
    </div>
  );
}

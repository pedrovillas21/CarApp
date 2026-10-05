import type { ReactNode } from 'react';
import { IconChevronLeft } from './Icons';

export function TopBar({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <header className="flex items-center gap-1.5 pt-[max(14px,env(safe-area-inset-top))] pr-5 pb-1.5 pl-3">
      <button type="button" onClick={onBack} aria-label="Voltar" className="flex size-11 items-center justify-center rounded-xl">
        <IconChevronLeft />
      </button>
      <h1 className="flex-1 text-xl font-bold">{title}</h1>
      {right}
    </header>
  );
}

export function Steps({ current }: { current: 1 | 2 }) {
  const steps = ['KM final', 'Assinatura'];
  return (
    <ol className="grid grid-cols-2 gap-2 px-5 pt-1.5" aria-label={`Etapa ${current} de 2`}>
      {steps.map((label, index) => {
        const step = index + 1;
        const done = step <= current;
        return (
          <li key={label} className="flex flex-col gap-1.5" aria-current={step === current ? 'step' : undefined}>
            <span className={`h-[5px] rounded-full ${done ? 'bg-azul' : 'bg-cinza'}`} />
            <span className={`text-[13px] ${step === current ? 'font-bold' : 'text-azul/80'}`}>
              {step} · {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

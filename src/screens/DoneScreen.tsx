import type { ReactNode } from 'react';
import { m } from 'motion/react';
import { Button } from '../components/Button';
import { IconClock, IconFuel, IconGauge, IconPen } from '../components/Icons';
import type { FinishedTrip } from '../lib/api';
import { describeRefuel, formatKm, formatTime } from '../lib/format';

export function DoneScreen({ summary, onHome }: { summary: FinishedTrip; onHome: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col">
      <section className="flex flex-1 flex-col items-center justify-center gap-[18px] px-7 py-10 text-center">
        <m.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          className="flex size-[120px] items-center justify-center rounded-full bg-verde"
        >
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <m.path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3, delay: 0.2, ease: 'easeOut' }}
            />
          </svg>
        </m.div>
        <h1 className="mt-2.5 text-[28px] font-bold">Veículo devolvido</h1>
        <p className="max-w-[300px] text-base leading-normal text-azul/80">
          O {summary.model} ({summary.plate}) já está disponível para a próxima viagem.
        </p>
        <m.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, delay: 0.2, ease: 'easeOut' }}
          className="mt-2.5 flex w-full flex-col rounded-2xl bg-cinza/55 px-[18px] py-1 text-left"
        >
          <Row icon={<IconClock />}>
            Registro salvo às <strong>{formatTime(summary.endedAt)}</strong>
          </Row>
          <Row icon={<IconGauge />} divider>
            KM atualizado para <strong className="tabular-nums">{formatKm(summary.kmEnd)}</strong>
          </Row>
          {summary.refuel && (
            <Row icon={<IconFuel />} divider>
              {describeRefuel(summary.refuel)}
            </Row>
          )}
          <Row icon={<IconPen />} divider>
            Assinatura anexada
          </Row>
        </m.div>
      </section>
      <footer className="px-5 pt-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        <Button onClick={onHome}>Voltar ao início</Button>
      </footer>
    </main>
  );
}

function Row({ icon, divider = false, children }: { icon: ReactNode; divider?: boolean; children: ReactNode }) {
  return (
    <div className={`flex items-center gap-3 py-[13px] text-[15px] ${divider ? 'border-t border-cinza' : ''}`}>
      {icon}
      <span>{children}</span>
    </div>
  );
}

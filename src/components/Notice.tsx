import type { ReactNode } from 'react';
import { m } from 'motion/react';
import { IconAlert, IconInfo } from './Icons';

type Tone = 'error' | 'warning' | 'info';

const TONES: Record<Tone, { box: string; icon: string }> = {
  error: { box: 'border-coral bg-coral/10', icon: 'text-coral' },
  warning: { box: 'border-laranja bg-laranja/20', icon: 'text-azul' },
  info: { box: 'border-azul-claro bg-azul-claro/20', icon: 'text-azul' },
};

/** Caixa de mensagem: texto sempre azul (contraste); a cor do tom fica na borda e no ícone. */
export function Notice({ tone, children, action }: { tone: Tone; children: ReactNode; action?: ReactNode }) {
  const t = TONES[tone];
  return (
    <m.div
      role={tone === 'error' ? 'alert' : 'status'}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex items-start gap-3 rounded-[14px] border-[1.5px] px-4 py-3.5 text-sm leading-[1.45] ${t.box}`}
    >
      <span className={`flex shrink-0 ${t.icon}`}>{tone === 'info' ? <IconInfo /> : <IconAlert />}</span>
      <span className="flex-1">{children}</span>
      {action}
    </m.div>
  );
}

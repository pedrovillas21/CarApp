import { useEffect, useId, useRef, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';

/** Painel que sobe de baixo, com fundo escurecido. Esc ou toque no fundo fecham. */
export function Sheet({ open, onClose, title, icon, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>('button, a[href]')?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <m.div
            aria-hidden="true"
            className="absolute inset-0 bg-azul/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <m.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative flex w-full max-w-md flex-col gap-4 rounded-t-[28px] bg-white px-6 pt-3 pb-[max(28px,env(safe-area-inset-bottom))]"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
            <span aria-hidden="true" className="h-[5px] w-10 self-center rounded-full bg-cinza" />
            {icon}
            <h2 id={titleId} className="text-[22px] font-bold">
              {title}
            </h2>
            {children}
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}

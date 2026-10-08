import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { m } from 'motion/react';

type Variant = 'primary' | 'accent' | 'outline';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-azul text-white',
  accent: 'bg-verde text-azul',
  outline: 'border-[1.5px] border-azul bg-transparent text-azul',
};

type ButtonProps = Omit<ComponentPropsWithoutRef<'button'>, 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd'> & {
  variant?: Variant;
  loading?: boolean;
  loadingLabel?: string;
  icon?: ReactNode;
};

export function Button({ variant = 'primary', loading = false, loadingLabel = 'Salvando…', icon, children, className = '', disabled, type = 'button', ...props }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <m.button
      type={type}
      whileTap={isDisabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.15 }}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-[14px] px-4 text-[17px] font-bold disabled:border-0 disabled:bg-cinza disabled:text-azul/60 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      <span>{loading ? loadingLabel : children}</span>
    </m.button>
  );
}

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return <span aria-hidden="true" className={`${className} animate-spin rounded-full border-2 border-current border-r-transparent`} />;
}

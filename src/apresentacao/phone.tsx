import type { ReactNode } from 'react';
import { m, type MotionValue } from 'motion/react';
import { ease, keyframe, Scene, useFn, useKeys } from './timeline';

export const PHONE_W = 414;
export const PHONE_H = 868;

/** Moldura do celular. Fundo do vídeo é azul, então a borda é cinza clara (paleta do manual). */
export function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="relative rounded-[62px] bg-cinza p-3 shadow-[0_0_0_1.5px_rgb(255_255_255/0.55)_inset]" style={{ width: PHONE_W, height: PHONE_H }}>
      <div className="relative size-full overflow-hidden rounded-[50px] bg-white">
        {children}
        <span className="absolute top-[11px] left-1/2 z-50 h-[32px] w-[112px] -translate-x-1/2 rounded-full bg-azul" />
      </div>
    </div>
  );
}

export function StatusBar({ time, dark = false }: { time: string | MotionValue<string>; dark?: boolean }) {
  return (
    <div className={`flex h-[50px] shrink-0 items-center justify-between px-[34px] pt-1.5 text-[16px] font-bold tabular-nums ${dark ? 'text-white' : 'text-azul'}`}>
      <m.span>{time}</m.span>
      <span className="flex items-center gap-[6px]">
        <span className="flex items-end gap-[2px]">
          {[5, 7, 9, 11].map((h) => (
            <span key={h} className="w-[3px] rounded-[1px] bg-current" style={{ height: h }} />
          ))}
        </span>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor" aria-hidden="true">
          <path d="M8 11.5l2.6-3.1a3.9 3.9 0 0 0-5.2 0L8 11.5zM3.2 5.8l1.4 1.7a5.4 5.4 0 0 1 6.8 0l1.4-1.7a7.6 7.6 0 0 0-9.6 0zM1 3.2l1.4 1.7a8.9 8.9 0 0 1 11.2 0L15 3.2a11.1 11.1 0 0 0-14 0z" />
        </svg>
        <span className="relative flex h-[12px] w-[25px] items-center rounded-[4px] border-[1.5px] border-current p-[1.5px] opacity-90">
          <span className="h-full w-[70%] rounded-[1.5px] bg-current" />
        </span>
      </span>
    </div>
  );
}

/** Uma tela dentro do celular: entra pela direita e sai pela esquerda, como no app (transição de 0,18 s, aqui um pouco mais longa). */
export function Screen({ from, to, exit = true, className = 'bg-white', children }: {
  from: number;
  to: number;
  exit?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Scene from={from} to={to}>
      <ScreenMotion dur={to - from} exit={exit} className={className}>
        {children}
      </ScreenMotion>
    </Scene>
  );
}

function ScreenMotion({ dur, exit, className, children }: { dur: number; exit: boolean; className: string; children: ReactNode }) {
  const times = exit ? [0, 0.4, dur - 0.3, dur] : [0, 0.4];
  const eases = exit ? [ease.expo, ease.linear, ease.in] : [ease.expo];
  const x = useKeys(times, exit ? [70, 0, 0, -70] : [70, 0], eases);
  const opacity = useKeys(exit ? [0, 0.2, dur - 0.2, dur] : [0, 0.2], exit ? [0, 1, 1, 0] : [0, 1], ease.linear);
  return (
    <m.div className={`absolute inset-0 flex flex-col overflow-hidden ${className}`} style={{ x, opacity }}>
      {children}
    </m.div>
  );
}

/** Toque do dedo com ripple: precisa estar dentro de um elemento `relative`. */
export function Tap({ at, dx = 0, dy = 0 }: { at: number; dx?: number; dy?: number }) {
  const dotOpacity = useKeys([at - 0.45, at - 0.2, at + 0.3, at + 0.55], [0, 1, 1, 0], [ease.out, ease.linear, ease.out]);
  const dotScale = useKeys([at - 0.45, at - 0.2, at, at + 0.12, at + 0.4], [1.5, 1, 1, 0.8, 1], [ease.out, ease.linear, ease.out, ease.pop]);
  const ringScale = useKeys([at, at + 0.6], [0.6, 2.4], ease.expo);
  const ringOpacity = useKeys([at - 0.01, at, at + 0.6], [0, 0.9, 0], ease.out);
  const pos = { left: `calc(50% + ${dx}px - 24px)`, top: `calc(50% + ${dy}px - 24px)` };
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-40">
      <m.span className="absolute size-12 rounded-full border-[3px] border-verde" style={{ ...pos, scale: ringScale, opacity: ringOpacity }} />
      <m.span className="absolute size-12 rounded-full border-[3px] border-white bg-azul/35" style={{ ...pos, scale: dotScale, opacity: dotOpacity }} />
    </span>
  );
}

/** Afundada do elemento no instante do toque (mola na volta). */
export function usePress(at: number) {
  return useKeys([at - 0.02, at + 0.1, at + 0.45], [1, 0.95, 1], [ease.out, ease.pop]);
}

/** Dedo livre (ex.: assinatura), seguindo coordenadas animadas. */
export function Finger({ x, y, opacity }: { x: MotionValue<number>; y: MotionValue<number>; opacity: MotionValue<number> }) {
  return (
    <m.span
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 z-40 -mt-6 -ml-6 size-12 rounded-full border-[3px] border-white bg-azul/35"
      style={{ x, y, opacity }}
    />
  );
}

/** Contorno verde que pulsa em volta de um trecho (dentro de um pai `relative`). Só transform e opacity. */
export function Ring({ from, to, radius = 18, inset = -5 }: { from: number; to: number; radius?: number; inset?: number }) {
  const opacity = useKeys([from, from + 0.3, to - 0.3, to], [0, 1, 1, 0], [ease.out, ease.linear, ease.in]);
  const scale = useFn((t) => (t < from ? 1.06 : 1 + 0.06 * (1 - ease.expo(Math.min(1, (t - from) / 0.5))) + 0.008 * Math.sin((t - from) * 5)));
  return (
    <m.span
      aria-hidden="true"
      className="pointer-events-none absolute z-30 border-[3px] border-verde"
      style={{ inset, borderRadius: radius, opacity, scale }}
    />
  );
}

export type CursorStop = { t: number; x: number; y: number; click?: boolean };

/** Ponteiro do mouse (painel no computador): desliza entre paradas e afunda nos cliques. */
export function Cursor({ stops, show }: { stops: CursorStop[] | (() => CursorStop[]); show: [number, number] }) {
  // Paradas podem vir de medidas do layout (função lida a cada quadro).
  const get = () => (typeof stops === 'function' ? stops() : stops);
  const x = useFn((t) => keyframe(t, get().map((s) => s.t), get().map((s) => s.x), ease.inOut));
  const y = useFn((t) => keyframe(t, get().map((s) => s.t), get().map((s) => s.y), ease.inOut));
  const clicks = get().filter((s) => s.click).map((s) => s.t);
  const scale = useFn((t) => {
    let s = 1;
    for (const c of clicks) if (t >= c - 0.05 && t <= c + 0.3) s = Math.min(s, 1 - 0.18 * Math.sin(((t - c + 0.05) / 0.35) * Math.PI));
    return s;
  });
  const opacity = useKeys([show[0], show[0] + 0.3, show[1] - 0.3, show[1]], [0, 1, 1, 0], ease.linear);
  const ripple = useFn((t) => {
    const last = clicks.filter((c) => t >= c).pop();
    return last === undefined ? 0 : Math.max(0, 1 - (t - last) / 0.5);
  });
  const rippleScale = useFn((t) => {
    const last = clicks.filter((c) => t >= c).pop();
    return last === undefined ? 0.5 : 0.5 + 1.6 * ease.expo(Math.min(1, (t - last) / 0.5));
  });
  return (
    <m.div aria-hidden="true" className="pointer-events-none absolute top-0 left-0 z-50" style={{ x, y, opacity }}>
      <m.span className="absolute -top-6 -left-6 size-12 rounded-full border-[3px] border-verde" style={{ opacity: ripple, scale: rippleScale }} />
      <m.svg width="30" height="36" viewBox="0 0 30 36" style={{ scale, originX: 0, originY: 0 }}>
        <path d="M2 2l0 27 7.5-7 5 11.5 5-2.2-5-11.3 10.5-.3z" fill="#ffffff" stroke="#2e2f71" strokeWidth="2.2" strokeLinejoin="round" />
      </m.svg>
    </m.div>
  );
}

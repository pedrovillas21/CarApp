import { createContext, useContext, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { backOut, cubicBezier, m, useMotionValueEvent, useTransform, type MotionValue } from 'motion/react';

/**
 * Linha do tempo do vídeo: um único MotionValue (`time`, em segundos) comanda tudo.
 * Ao vivo ele avança com o relógio; na gravação, o script posiciona quadro a quadro.
 * Assim cada quadro sai idêntico, sem depender da velocidade da máquina.
 */

type Ease = (t: number) => number;

/** Mola com leve repique (oscilador amortecido resolvido em fórmula), normalizada para 0..1. */
function springEase(stiffness: number, damping: number): Ease {
  const w0 = Math.sqrt(stiffness);
  const zeta = damping / (2 * w0);
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  const settle = -Math.log(0.002) / (zeta * w0);
  return (p) => {
    if (p >= 1) return 1;
    const t = p * settle;
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  };
}

export const ease = {
  out: cubicBezier(0.22, 1, 0.36, 1),
  expo: cubicBezier(0.16, 1, 0.3, 1),
  inOut: cubicBezier(0.65, 0, 0.35, 1),
  in: cubicBezier(0.55, 0, 1, 0.45),
  back: backOut,
  pop: springEase(380, 22),
  soft: springEase(170, 20),
  linear: (t: number) => t,
};

const TimeContext = createContext<MotionValue<number> | null>(null);
const OffsetContext = createContext(0);
const ReducedContext = createContext(false);

/** educed: prefers-reduced-motion na versão interativa (câmera, parallax e 3D ficam quase parados). */
export function TimeProvider({ time, reduced = false, children }: { time: MotionValue<number>; reduced?: boolean; children: ReactNode }) {
  return (
    <TimeContext.Provider value={time}>
      <ReducedContext.Provider value={reduced}>{children}</ReducedContext.Provider>
    </TimeContext.Provider>
  );
}

export const useReduced = () => useContext(ReducedContext);

export function useClock() {
  const time = useContext(TimeContext);
  if (!time) throw new Error('useClock fora do TimeProvider');
  return time;
}

export const useOffset = () => useContext(OffsetContext);

/** Valor discreto derivado do tempo: só re-renderiza quando o resultado muda. */
export function useIs<T>(fn: (t: number) => T): T {
  const time = useClock();
  const offset = useOffset();
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const [value, setValue] = useState(() => fn(time.get() - offset));
  useMotionValueEvent(time, 'change', (t) => {
    const next = fnRef.current(t - offset);
    setValue((prev) => (Object.is(prev, next) ? prev : next));
  });
  return value;
}

export const useAfter = (at: number) => useIs((t) => t >= at);

/** Interpolação contínua entre dois instantes (relativos à cena atual). */
type Widen<T> = T extends number ? number : string;

export function useTween<T extends number | string>(from: number, to: number, output: [T, T], e: Ease = ease.out): MotionValue<Widen<T>> {
  const time = useClock();
  const offset = useOffset();
  return useTransform(time, [offset + from, offset + to], output, { ease: e, clamp: true }) as unknown as MotionValue<Widen<T>>;
}

/** Vários quadros-chave. `e` pode ser uma curva por trecho. */
export function useKeys<T extends number | string>(times: number[], output: T[], e: Ease | Ease[] = ease.out): MotionValue<Widen<T>> {
  const time = useClock();
  const offset = useOffset();
  return useTransform(
    time,
    times.map((t) => offset + t),
    output,
    { ease: e, clamp: true },
  ) as unknown as MotionValue<Widen<T>>;
}

/** Transformação livre do tempo relativo. A função mais recente sempre vale. */
export function useFn<T>(fn: (t: number) => T) {
  const time = useClock();
  const offset = useOffset();
  const fnRef = useRef(fn);
  fnRef.current = fn;
  return useTransform(time, (t: number) => fnRef.current(t - offset));
}

/** Cena: monta só no seu intervalo e torna os tempos internos relativos ao início. */
export function Scene({ from, to, children }: { from: number; to: number; children: ReactNode }) {
  const parent = useOffset();
  const visible = useIs((t) => t >= from - 0.05 && t <= to + 0.05);
  if (!visible) return null;
  return <OffsetContext.Provider value={parent + from}>{children}</OffsetContext.Provider>;
}

/** Entra (e opcionalmente sai) com fade + deslocamento. */
export function Reveal({
  at,
  dur = 0.6,
  out,
  outDur = 0.4,
  y = 24,
  x = 0,
  scale = 1,
  e = ease.out,
  className,
  style,
  children,
}: {
  at: number;
  dur?: number;
  out?: number;
  outDur?: number;
  y?: number;
  x?: number;
  scale?: number;
  e?: Ease;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const hasOut = out !== undefined;
  const times = hasOut ? [at, at + dur, out, out + outDur] : [at, at + dur];
  const eases = hasOut ? [e, ease.linear, ease.inOut] : [e];
  const opacity = useKeys(times, hasOut ? [0, 1, 1, 0] : [0, 1], eases);
  const ty = useKeys(times, hasOut ? [y, 0, 0, -y * 0.6] : [y, 0], eases);
  const tx = useKeys(times, hasOut ? [x, 0, 0, -x * 0.6] : [x, 0], eases);
  const sc = useKeys(times, hasOut ? [scale, 1, 1, 1] : [scale, 1], eases);
  return (
    <m.div className={className} style={{ ...style, opacity, y: ty, x: tx, scale: sc }}>
      {children}
    </m.div>
  );
}

/** Título que sobe palavra por palavra, cada uma saindo de trás de uma máscara. */
export function Words({ text, at, stagger = 0.06, dur = 0.7, out, className }: {
  text: string;
  at: number;
  stagger?: number;
  dur?: number;
  out?: number;
  className?: string;
}) {
  const words = text.split(' ');
  return (
    <span className={className}>
      {words.map((word, i) => (
        <Word key={i} word={word} at={at + i * stagger} dur={dur} out={out === undefined ? undefined : out + i * 0.02} last={i === words.length - 1} />
      ))}
    </span>
  );
}

function Word({ word, at, dur, out, last }: { word: string; at: number; dur: number; out?: number; last: boolean }) {
  const hasOut = out !== undefined;
  const times = hasOut ? [at, at + dur, out, out + 0.4] : [at, at + dur];
  const y = useKeys(times, hasOut ? ['110%', '0%', '0%', '-110%'] : ['110%', '0%'], hasOut ? [ease.out, ease.linear, ease.in] : [ease.out]);
  return (
    <span className="inline-block overflow-hidden pb-[0.12em] align-bottom" style={{ marginBottom: '-0.12em' }}>
      <m.span className="inline-block" style={{ y }}>
        {word}
      </m.span>
      {!last && ' '}
    </span>
  );
}

/** Texto digitado letra a letra. */
export function useTyped(text: string, at: number, perChar = 0.07) {
  return useIs((t) => text.slice(0, Math.max(0, Math.min(text.length, Math.floor((t - at) / perChar) + 1))) || '');
}


/* ---------- funções puras do tempo (para compor dentro de useFn) ---------- */

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Trecho a..b normalizado com curva. */
export const seg = (t: number, a: number, b: number, e: Ease = ease.inOut) => e(clamp01((t - a) / (b - a)));

/** Quadros-chave numéricos como função pura. */
export function keyframe(t: number, times: number[], values: number[], e: Ease = ease.inOut) {
  if (t <= times[0]) return values[0];
  for (let i = 1; i < times.length; i++) {
    if (t <= times[i]) return values[i - 1] + (values[i] - values[i - 1]) * e((t - times[i - 1]) / (times[i] - times[i - 1] || 1));
  }
  return values[values.length - 1];
}

/** Estado liga/desliga suavizado (0..1) a partir de trocas [instante, ligado]. */
export function stateAt(t: number, initial: boolean, switches: [number, boolean][], dur = 0.22) {
  let value = initial ? 1 : 0;
  for (const [at, on] of switches) {
    if (t < at) break;
    value += ((on ? 1 : 0) - value) * ease.out(clamp01((t - at) / dur));
  }
  return value;
}

/** Crossfade de estado (selecionado, habilitado, foco) sem transition de CSS. */
export function useToggle(initial: boolean, switches: [number, boolean][], dur = 0.22) {
  return useFn((t) => stateAt(t, initial, switches, dur));
}

/** Número que conta até o valor final. */
export function useCount(to: number, at: number, dur: number, format: (n: number) => string, from = 0) {
  return useFn((t) => format(from + (to - from) * seg(t, at, at + dur, ease.out)));
}

/* ---------- câmera ---------- */

export type Shot = { t: number; s: number; fx: number; fy: number };

/**
 * Zoom e pan sobre um elemento w×h: em cada tomada, aproxima `s` vezes mantendo o ponto (fx, fy) no lugar.
 * Com prefers-reduced-motion o zoom quase some.
 */
export function useCamera(shots: Shot[], w: number, h: number) {
  const reduced = useReduced();
  const times = shots.map((s) => s.t);
  const frame = (t: number) => {
    const raw = keyframe(t, times, shots.map((s) => s.s));
    const s = reduced ? 1 + (raw - 1) * 0.1 : raw;
    const fx = keyframe(t, times, shots.map((s) => s.fx));
    const fy = keyframe(t, times, shots.map((s) => s.fy));
    return { s, x: (1 - s) * (fx - w / 2), y: (1 - s) * (fy - h / 2) };
  };
  return { scale: useFn((t) => frame(t).s), x: useFn((t) => frame(t).x), y: useFn((t) => frame(t).y) };
}

/** Deriva lenta para parallax (amplitude zerada com prefers-reduced-motion). */
export function useDrift(amp: number, period: number, phase = 0) {
  const reduced = useReduced();
  return useFn((t) => (reduced ? 0 : Math.sin((t / period) * Math.PI * 2 + phase) * amp));
}

/* ---------- ícone que se desenha ---------- */

/** Traços de um ícone 24×24 desenhados um após o outro (pathLength). */
export function DrawIcon({ paths, size, at, dur = 0.9, strokeWidth = 2, className }: {
  paths: string[];
  size: number;
  at: number;
  dur?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {paths.map((d, i) => (
        <DrawPath key={i} d={d} at={at + (i * dur) / (paths.length + 1)} dur={(dur * 2) / (paths.length + 1)} />
      ))}
    </svg>
  );
}

function DrawPath({ d, at, dur }: { d: string; at: number; dur: number }) {
  const pathLength = useTween(at, at + dur, [0, 1], ease.inOut);
  const opacity = useFn((t) => (t >= at ? 1 : 0));
  return <m.path d={d} style={{ pathLength, opacity }} />;
}
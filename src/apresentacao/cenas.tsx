import type { ReactNode } from 'react';
import { m, useMotionTemplate } from 'motion/react';
import { LogoCompleta } from '../components/Logo';
import { DEMO, type Cue } from './roteiro';
import { clamp01, DrawIcon, ease, Reveal, seg, useDrift, useFn, useIs, useKeys, useOffset, useTween, Words } from './timeline';

/* ---------- fundo ---------- */

/** Azul do manual com manchas orgânicas verde/coral bem sutis, em camadas com velocidades diferentes (parallax). */
export function Backdrop({ w, h, seed = 0 }: { w: number; h: number; seed?: number }) {
  const ax = useDrift(w * 0.03, 13, seed);
  const ay = useDrift(h * 0.03, 17, seed + 1);
  const bx = useDrift(w * 0.05, 19, seed + 2);
  const by = useDrift(h * 0.04, 11, seed + 3);
  const cx = useDrift(w * 0.02, 23, seed + 4);
  const big = Math.max(w, h);
  return (
    <div className="absolute inset-0 overflow-hidden bg-azul">
      <m.span
        className="absolute rounded-full"
        style={{ width: big * 1.1, height: big * 1.1, left: -big * 0.35, top: -big * 0.55, x: ax, y: ay, background: 'radial-gradient(circle, rgb(50 208 176 / 0.17), transparent 62%)' }}
      />
      <m.span
        className="absolute rounded-full"
        style={{ width: big * 0.9, height: big * 0.9, right: -big * 0.3, bottom: -big * 0.45, x: bx, y: by, background: 'radial-gradient(circle, rgb(254 91 89 / 0.10), transparent 60%)' }}
      />
      <m.span
        className="absolute rounded-full"
        style={{ width: big * 0.7, height: big * 0.7, left: w * 0.45, top: -big * 0.2, x: cx, background: 'radial-gradient(circle, rgb(131 200 205 / 0.10), transparent 60%)' }}
      />
    </div>
  );
}

/* ---------- transições ---------- */

/**
 * Wipe em duas camadas a partir de um ponto: um círculo verde cresce e, logo atrás, a nova cena.
 * Monta só no intervalo [at, until].
 */
export function RingLayer({ at, until, cx, cy, w, h, dur = 0.9, seed = 0, children }: {
  at: number;
  until: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
  dur?: number;
  seed?: number;
  children: ReactNode;
}) {
  const visible = useIs((t) => t >= at - 0.02 && t <= until);
  if (!visible) return null;
  return (
    <RingLayerInner at={at} cx={cx} cy={cy} w={w} h={h} dur={dur} seed={seed}>
      {children}
    </RingLayerInner>
  );
}

function RingLayerInner({ at, cx, cy, w, h, dur, seed, children }: { at: number; cx: number; cy: number; w: number; h: number; dur: number; seed: number; children: ReactNode }) {
  const max = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) + 40;
  const lag = 0.16;
  const r1 = useTween(at, at + dur, [0, max], ease.inOut);
  const ringClip = useMotionTemplate`circle(${r1}px at ${cx}px ${cy}px)`;
  const sceneClip = useFn((t) => (t >= at + dur + lag ? 'none' : `circle(${max * seg(t, at + lag, at + dur + lag)}px at ${cx}px ${cy}px)`));
  const ringVisible = useIs((t) => t < at + dur + lag + 0.05);
  return (
    <>
      {ringVisible && <m.div className="absolute inset-0 bg-verde" style={{ clipPath: ringClip }} />}
      <m.div className="absolute inset-0" style={{ clipPath: sceneClip }}>
        <Backdrop w={w} h={h} seed={seed} />
        {children}
      </m.div>
    </>
  );
}

/** Corte seco com "estalo" de escala e leve empurrão contínuo de câmera. */
export function Cut({ from, to, children }: { from: number; to: number; children: ReactNode }) {
  const visible = useIs((t) => t >= from && t < to);
  const scale = useFn((t) => (1.08 - 0.08 * seg(t, from, from + 0.4, ease.expo)) * (1 + 0.035 * clamp01((t - from) / (to - from))));
  if (!visible) return null;
  return (
    <m.div className="absolute inset-0" style={{ scale }}>
      {children}
    </m.div>
  );
}

/* ---------- gancho ---------- */

function QuestionCard({ at, className = '' }: { at: number; className?: string }) {
  // "Com: ?" — o mesmo cartão laranja do app, ainda sem resposta.
  const pulse = useFn((t) => 1 + 0.04 * Math.max(0, Math.sin((t - at) * 4)));
  return (
    <Reveal at={at} y={30} e={ease.expo} className={className}>
      <div className="flex w-[460px] items-center gap-5 rounded-3xl bg-white p-5 text-azul">
        <img src={DEMO.car.image} alt="" className="h-[60px] w-[110px] object-contain" />
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-[22px] font-bold">{DEMO.car.model}</span>
          <span className="text-[16px] text-azul/80">Com quem?</span>
        </div>
        <m.span style={{ scale: pulse }} className="flex size-[60px] items-center justify-center rounded-full bg-laranja text-[30px] font-bold">
          ?
        </m.span>
      </div>
    </Reveal>
  );
}

/** Pergunta de abertura (usada nos três formatos). */
export function HookQuestion({ size, at = 0.05, card = true, width }: { size: number; at?: number; card?: boolean; width: number }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-14 px-[6%] text-center">
      <h1 className="font-bold tracking-[-2px] text-white" style={{ fontSize: size, lineHeight: 1.04, maxWidth: width }}>
        <Words text="Quem está com o carro" at={at} stagger={0.07} dur={0.55} />
        <Reveal at={at + 0.42} y={0} scale={1.6} e={ease.pop} className="inline-block text-coral">
          ?
        </Reveal>
      </h1>
      {card && <QuestionCard at={at + 0.6} />}
    </div>
  );
}

const SCRIBBLE = 'M2 26 L 14 8 L 24 30 L 36 6 L 48 32 L 60 8 L 72 30 L 84 10 L 96 24';

/** Planilha de papel com o KM rasurado. */
function Sheet({ at }: { at: number }) {
  const strike = useTween(at + 0.45, at + 0.95, [0, 1], ease.inOut);
  const rows = [
    ['02/10', 'Carro 1', '2.952', '3.071', 'L. P.'],
    ['03/10', 'Carro 2', '3.288', '3.301', 'R. C.'],
    ['06/10', 'Carro 2', '3.301', '3.4O5', '?'],
    ['06/10', 'Carro 1', '3.071', '', ''],
  ];
  return (
    <Reveal at={at} y={40} x={60} e={ease.expo}>
      <div className="w-[760px] -rotate-3 rounded-lg bg-white p-7 text-azul shadow-[0_40px_80px_rgb(20_20_60/0.35)]">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[24px] font-bold">Controle de veículos</span>
          <span className="text-[16px] text-azul/60">Outubro</span>
        </div>
        <div className="grid grid-cols-[90px_120px_1fr_1fr_110px] border-t-2 border-azul/70 text-[20px]">
          {['Data', 'Carro', 'KM saída', 'KM volta', 'Assin.'].map((h) => (
            <span key={h} className="border-b border-cinza py-2 font-bold">
              {h}
            </span>
          ))}
          {rows.map((row, i) =>
            row.map((cell, j) => (
              <span key={`${i}-${j}`} className="relative border-b border-cinza py-2.5 italic">
                {cell || <span className="text-azul/30">—</span>}
                {i === 2 && j === 3 && (
                  <svg className="absolute top-1 -left-2 overflow-visible" width="100" height="38" viewBox="0 0 100 38" fill="none">
                    <m.path d={SCRIBBLE} stroke="#fe5b59" strokeWidth={5} strokeLinecap="round" style={{ pathLength: strike }} />
                  </svg>
                )}
              </span>
            )),
          )}
        </div>
      </div>
    </Reveal>
  );
}

/** Cupom de posto sem valor anotado. */
function Receipt({ at }: { at: number }) {
  return (
    <Reveal at={at} y={60} e={ease.expo}>
      <div className="flex w-[330px] rotate-[5deg] flex-col gap-4 rounded-md bg-white px-7 py-8 text-azul shadow-[0_40px_80px_rgb(20_20_60/0.35)]">
        <span className="flex justify-center text-azul/80">
          <DrawIcon paths={FUEL_PATHS} size={72} at={at + 0.2} dur={0.8} strokeWidth={1.6} />
        </span>
        <span className="text-center text-[18px] font-bold tracking-[2px]">CUPOM</span>
        {['Litros', 'Preço', 'Placa'].map((label) => (
          <span key={label} className="flex justify-between border-b border-dashed border-cinza pb-2 text-[18px]">
            <span>{label}</span>
            <span className="font-bold text-coral">?</span>
          </span>
        ))}
        <span className="flex justify-between pt-1 text-[24px] font-bold">
          <span>Total</span>
          <span className="text-coral">R$ ?</span>
        </span>
      </div>
    </Reveal>
  );
}

/** Gancho da versão principal: três cortes rápidos. */
export function Hook({ cuts }: { cuts: number[] }) {
  const [a, b, c] = cuts;
  return (
    <>
      <Cut from={a} to={b}>
        <HookQuestion size={128} width={1500} />
      </Cut>
      <Cut from={b} to={c}>
        <div className="absolute inset-0 flex items-center justify-between px-[150px]">
          <h2 className="w-[700px] text-[96px] leading-[1.04] font-bold tracking-[-2px]">
            <Words text="O KM anotado confere?" at={0.05} stagger={0.06} dur={0.5} />
          </h2>
          <Sheet at={0.1} />
        </div>
      </Cut>
      <Cut from={c} to={c + 2.4}>
        <div className="absolute inset-0 flex items-center justify-center gap-32 px-[180px]">
          <Receipt at={0.1} />
          <h2 className="w-[860px] text-right text-[96px] leading-[1.04] font-bold tracking-[-2px]">
            <Words text="Quanto foi abastecido?" at={0.05} stagger={0.06} dur={0.5} />
          </h2>
        </div>
      </Cut>
    </>
  );
}

/* ---------- marca ---------- */

/** Logo (versão negativa, sobre azul), nome e assinatura. Área de respiro: gap ≥ altura de "Crefito". */
export function BrandBlock({ at, logo, title, tagline, out }: { at: number; logo: number; title: number; tagline: number; out?: number }) {
  return (
    <div className="flex flex-col items-center gap-16 text-center">
      <Reveal at={at} dur={0.9} y={24} scale={0.92} e={ease.expo} out={out}>
        <LogoCompleta width={logo} />
      </Reveal>
      <div className="flex flex-col items-center gap-5">
        <h1 className="leading-none font-bold tracking-[-2px]" style={{ fontSize: title }}>
          <Words text="Controle de Frota" at={at + 0.35} stagger={0.09} dur={0.7} out={out} />
        </h1>
        <Reveal at={at + 0.9} y={16} e={ease.expo} out={out}>
          <p className="text-white/85" style={{ fontSize: tagline }}>
            Cada viagem, registrada em segundos.
          </p>
        </Reveal>
      </div>
    </div>
  );
}

/* ---------- legendas ---------- */

export function Eyebrow({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <span className="inline-flex rounded-full bg-verde px-5 py-2 font-bold tracking-[0.6px] text-azul uppercase" style={{ fontSize: size }}>
      {children}
    </span>
  );
}

/** Legenda de benefício: rótulo + frase curta entrando palavra a palavra. Tempos relativos à cena. */
export function Caption({ eyebrow, text, at, out, size, align = 'left', width }: {
  eyebrow?: string;
  text: string;
  at: number;
  out: number;
  size: number;
  align?: 'left' | 'center';
  width: number;
}) {
  return (
    <div className={`flex flex-col gap-6 ${align === 'center' ? 'items-center text-center' : 'items-start'}`} style={{ width }}>
      {eyebrow && (
        <Reveal at={at} y={14} e={ease.expo} out={out}>
          <Eyebrow>{eyebrow}</Eyebrow>
        </Reveal>
      )}
      <h2 className="leading-[1.06] font-bold tracking-[-1.5px] text-white" style={{ fontSize: size }}>
        <Words text={text} at={at + 0.1} stagger={0.07} dur={0.6} out={out} />
      </h2>
    </div>
  );
}

/** Legendas queimadas da narração (versão muda). */
export function Subtitles({ cues, bottom, size, maxWidth }: { cues: Cue[]; bottom: number; size: number; maxWidth: number }) {
  const offset = useOffset();
  const index = useIs((t) => cues.findIndex((c, i) => t + offset >= c.at - 0.1 && t + offset < Math.min(c.limit + 0.2, cues[i + 1]?.at ?? 1e9)));
  const cue = index >= 0 ? cues[index] : null;
  return (
    <div className="pointer-events-none absolute inset-x-0 z-50 flex justify-center" style={{ bottom }}>
      {cue && <SubtitleLine key={index} cue={cue} size={size} maxWidth={maxWidth} />}
    </div>
  );
}

function SubtitleLine({ cue, size, maxWidth }: { cue: Cue; size: number; maxWidth: number }) {
  const opacity = useKeys([cue.at - 0.1, cue.at + 0.05], [0, 1], ease.out);
  return (
    <m.span className="rounded-2xl bg-azul/95 px-8 py-3 text-center leading-[1.3] font-medium text-white" style={{ opacity, fontSize: size, maxWidth }}>
      {cue.text}
    </m.span>
  );
}

/* ---------- benefícios ---------- */

const FUEL_PATHS = ['M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16', 'M3 21h13', 'M7 7h5v4H7z', 'M15 10h2a2 2 0 0 1 2 2v4.5a1.5 1.5 0 0 0 3 0V9l-3-3'];

export const PROOF_ICONS: string[][] = [
  ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M12 7v5l3 2'],
  ['M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z', 'M9 12l2 2 4-4'],
  ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0'],
  FUEL_PATHS,
];

export function ProofCard({ index, at, title, text, nextAt }: { index: number; at: number; title: string; text: string; nextAt?: number }) {
  const y = useTween(at, at + 0.7, [70, 0], ease.expo);
  const opacity = useTween(at, at + 0.3, [0, 1]);
  const scale = useTween(at, at + 0.7, [0.9, 1], ease.pop);
  // Card ativo sobe um pouco e ganha contorno; ao chegar o próximo, volta.
  const active = useFn((t) => (t < at ? 0 : nextAt !== undefined && t > nextAt ? Math.max(0, 1 - (t - nextAt) / 0.4) : Math.min(1, (t - at) / 0.4)));
  const ring = active;
  const lift = useFn((t) => -14 * (t < at ? 0 : nextAt !== undefined && t > nextAt ? Math.max(0, 1 - (t - nextAt) / 0.4) : Math.min(1, (t - at) / 0.4)));
  return (
    <m.div style={{ y, opacity, scale }} className="relative">
      <m.div style={{ y: lift }} className="relative flex h-[440px] w-[380px] flex-col items-center gap-7 rounded-[32px] bg-white/[0.07] px-8 pt-12 text-center">
        <m.span aria-hidden="true" className="absolute inset-0 rounded-[32px] border-[3px] border-verde" style={{ opacity: ring }} />
        <span className="flex size-[140px] items-center justify-center rounded-full bg-verde text-azul">
          <DrawIcon paths={PROOF_ICONS[index]} size={72} at={at + 0.25} dur={0.9} strokeWidth={1.8} />
        </span>
        <span className="text-[44px] leading-none font-bold">{title}</span>
        <span className="text-[26px] leading-[1.35] text-white/80">{text}</span>
      </m.div>
    </m.div>
  );
}

/* ---------- fechamento ---------- */

/** Anéis verdes pulsando (o mesmo motivo do cronômetro do app). */
export function Rings({ cx, cy, size, at = 0 }: { cx: number; cy: number; size: number; at?: number }) {
  const grow = useTween(at, at + 1.2, [0.6, 1], ease.expo);
  const show = useTween(at, at + 0.8, [0, 1]);
  return (
    <m.div className="pointer-events-none absolute" style={{ left: cx - size / 2, top: cy - size / 2, width: size, height: size, scale: grow, opacity: show }}>
      <span className="absolute inset-0 rounded-full border-2 border-verde/25" />
      <span className="absolute inset-[12%] rounded-full border-2 border-verde/15" />
      {[0, 1, 2].map((i) => (
        <Pulse key={i} phase={i / 3} />
      ))}
    </m.div>
  );
}

function Pulse({ phase }: { phase: number }) {
  const p = (t: number) => (((t / 3.6 + phase) % 1) + 1) % 1;
  const scale = useFn((t) => 0.5 + 0.6 * ease.out(p(t)));
  const opacity = useFn((t) => 0.5 * (1 - p(t)));
  return <m.span className="absolute inset-0 rounded-full border-2 border-verde" style={{ scale, opacity }} />;
}

/** Chamada para ação com o contato do conselho. */
export function Contact({ at, size }: { at: number; size: number }) {
  const glow = useFn((t) => (t < at + 0.8 ? 0 : 0.5 + 0.5 * Math.sin((t - at) * 2.4)));
  return (
    <Reveal at={at} y={30} e={ease.expo} className="flex flex-col items-center gap-4">
      <span className="font-bold text-verde" style={{ fontSize: size * 0.8 }}>
        Peça seu acesso
      </span>
      <span className="relative inline-flex items-center gap-4 rounded-2xl bg-white px-8 py-4 font-bold text-azul" style={{ fontSize: size }}>
        <m.span aria-hidden="true" className="absolute -inset-[6px] rounded-[22px] border-[3px] border-verde" style={{ opacity: glow }} />
        <svg width={size * 1.1} height={size * 1.1} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        </svg>
        {DEMO.contact}
      </span>
    </Reveal>
  );
}


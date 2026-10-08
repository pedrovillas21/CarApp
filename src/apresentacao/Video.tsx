import { useEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { m, useAnimationFrame, useMotionValue, useMotionValueEvent, type MotionValue } from 'motion/react';
import { AdminPanel, PANEL_H, PANEL_W } from './admin';
import { Backdrop, BrandBlock, Caption, Contact, Cut, Eyebrow, Hook, HookQuestion, ProofCard, RingLayer, Rings, Subtitles } from './cenas';
import { Phone, PHONE_H, PHONE_W, Screen } from './phone';
import { AUDIO, CAPTIONS, CHAPTERS, MAIN, PROOF, SHORT, SHORT_CAPTIONS, SUBTITLES, TEASER, type Format } from './roteiro';
import { DoneMock, FuelMock, HomeMock, KmMock, LoginMock, SignMock, StartMock, TripMock } from './screens';
import { ease, Reveal, Scene, TimeProvider, useCamera, useFn, useIs, useKeys, useReduced, useTween, Words, type Shot } from './timeline';

export const SIZES: Record<Format, { w: number; h: number; duration: number }> = {
  '16x9': { w: 1920, h: 1080, duration: MAIN.duration },
  '9x16': { w: 1080, h: 1920, duration: SHORT.duration },
  '1x1': { w: 1080, h: 1080, duration: TEASER.duration },
};

/* ---------- celular com entrada 3D e câmera ---------- */

function PhoneRig({ left, top, scale = 1, enter, shots, children }: {
  left: number;
  top: number;
  scale?: number;
  enter: number;
  shots: Shot[];
  children: ReactNode;
}) {
  const reduced = useReduced();
  const k = reduced ? 0.15 : 1;
  const y = useTween(enter, enter + 1.2, [180, 0], ease.expo);
  const opacity = useTween(enter, enter + 0.35, [0, 1]);
  const rotateY = useTween(enter, enter + 1.4, [-32 * k, 0], ease.soft);
  const rotateX = useTween(enter, enter + 1.2, [10 * k, 0], ease.expo);
  // Respiração leve: o aparelho nunca fica 100% parado.
  const float = useFn((t) => (reduced ? 0 : Math.sin(t * 0.9) * 4));
  const cam = useCamera(shots, PHONE_W, PHONE_H);
  return (
    <div className="absolute" style={{ left, top, width: PHONE_W * scale, height: PHONE_H * scale, perspective: 1800 }}>
      <m.div style={{ y, opacity, rotateY, rotateX, scale, translateY: float, originX: 0, originY: 0 }}>
        <m.div style={{ scale: cam.scale, x: cam.x, y: cam.y }}>
          <Phone>
            <div className="text-azul">{children}</div>
          </Phone>
        </m.div>
      </m.div>
    </div>
  );
}

/** Tomadas de câmera de uma tela: aproxima no foco e volta. */
function shotsFor(beat: { from: number; to: number }, s: number, fx: number, fy: number, inAt = 0.7, outAt = 1.2): Shot[] {
  return [
    { t: beat.from + 0.2, s: 1, fx: 207, fy: 434 },
    { t: beat.from + inAt, s, fx, fy },
    { t: beat.to - outAt, s, fx, fy },
    { t: beat.to - outAt + 0.7, s: 1, fx: 207, fy: 434 },
  ];
}

/* ---------- 16:9 principal ---------- */

const MAIN_PHONE = { left: 1340 - PHONE_W / 2, top: 106 };
const MAIN_SHOTS: Shot[] = [
  { t: 0, s: 1, fx: 207, fy: 434 },
  ...shotsFor(MAIN.screens.login, 1.16, 207, 470, 2.4, 1.6),
  ...shotsFor(MAIN.screens.home, 1.28, 207, 760, 1.2, 1.3),
  ...shotsFor(MAIN.screens.start, 1.14, 207, 520, 0.9, 1.6),
  ...shotsFor(MAIN.screens.trip, 1.22, 207, 330, 0.9, 2.2),
  ...shotsFor(MAIN.screens.km, 1.2, 207, 270, 0.9, 2.0),
  ...shotsFor(MAIN.screens.fuel, 1.14, 207, 520, 1.3, 1.8),
  ...shotsFor(MAIN.screens.sign, 1.14, 207, 600, 0.9, 2.2),
  { t: MAIN.screens.done.from + 0.4, s: 1, fx: 207, fy: 434 },
  { t: MAIN.screens.done.from + 1.0, s: 1.1, fx: 207, fy: 330 },
];

/** Ponto do check verde da tela "Pronto", em coordenadas do vídeo (o wipe para a gestão parte dele). */
const DONE_POINT = { x: MAIN_PHONE.left + 12 + 207, y: MAIN_PHONE.top + 12 + 300 };

/** Faixa inferior reservada às legendas na versão muda: a cena encolhe para nenhum texto ficar por cima da interface. */
const SUB_SCALE = 0.86;
// Bordas da cena reduzida se dissolvem no fundo (sem caixa visível).
const EDGE_FADE = 'linear-gradient(to right, transparent, #000 5%, #000 95%, transparent), linear-gradient(to bottom, #000 90%, transparent)';

function Main({ subtitles }: { subtitles: boolean }) {
  const { w, h } = SIZES['16x9'];
  if (subtitles) {
    return (
      <>
        <Backdrop w={w} h={h} />
        <div
          className="absolute top-0 left-1/2 overflow-hidden"
          style={{ width: w, height: h, marginLeft: -w / 2, transform: `scale(${SUB_SCALE})`, transformOrigin: '50% 0', maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE, maskComposite: 'intersect', WebkitMaskComposite: 'source-in' }}
        >
          <MainScenes />
        </div>
        <Subtitles cues={SUBTITLES} bottom={(h * (1 - SUB_SCALE) - 64) / 2} size={34} maxWidth={1640} />
      </>
    );
  }
  return <MainScenes />;
}

function MainScenes() {
  const { w, h } = SIZES['16x9'];
  return (
    <>
      <Backdrop w={w} h={h} />
      <Scene from={MAIN.hook.from} to={MAIN.hook.to}>
        <Hook cuts={MAIN.hookCuts} />
      </Scene>
      <RingLayer at={MAIN.brand.from} until={MAIN.panorama.from + 1.2} cx={960} cy={540} w={w} h={h} seed={1}>
        <MainJourney />
      </RingLayer>
      <RingLayer at={MAIN.panorama.from - 0.2} until={MAIN.proof.from + 1.2} cx={DONE_POINT.x} cy={DONE_POINT.y} w={w} h={h} seed={2}>
        <Scene from={MAIN.panorama.from} to={MAIN.panorama.to}>
          <Panorama />
        </Scene>
      </RingLayer>
      <RingLayer at={MAIN.proof.from - 0.2} until={MAIN.close.from + 1.2} cx={960} cy={540} w={w} h={h} seed={3}>
        <Scene from={MAIN.proof.from} to={MAIN.proof.to}>
          <Proof />
        </Scene>
      </RingLayer>
      <RingLayer at={MAIN.close.from - 0.2} until={MAIN.duration} cx={960} cy={540} w={w} h={h} seed={4}>
        <Scene from={MAIN.close.from} to={MAIN.close.to}>
          <Close />
        </Scene>
      </RingLayer>
    </>
  );
}

function MainJourney() {
  const b = MAIN.brand;
  const brandX = useKeys([b.from + 2.1, b.from + 3.3], [0, -470], ease.inOut);
  const brandScale = useKeys([b.from + 2.1, b.from + 3.3], [1, 0.74], ease.inOut);
  const brandOpacity = useKeys([b.to - 0.6, b.to - 0.1], [1, 0], ease.in);
  const s = MAIN.screens;
  return (
    <>
      <Scene from={b.from} to={b.to}>
        <m.div className="absolute inset-x-0 top-[250px] flex justify-center" style={{ x: brandX, scale: brandScale, opacity: brandOpacity }}>
          <BrandBlock at={0.35} logo={420} title={104} tagline={40} />
        </m.div>
      </Scene>

      {(Object.keys(s) as (keyof typeof s)[]).map((key) => (
        <Scene key={key} from={s[key].from} to={s[key].to}>
          <div className="absolute top-[380px] left-[150px]">
            <Caption eyebrow={CAPTIONS[key].eyebrow} text={CAPTIONS[key].text} at={CAPTIONS[key].at} out={s[key].to - s[key].from - 0.5} size={84} width={860} />
          </div>
        </Scene>
      ))}
      <JourneyNav />

      <PhoneRig left={MAIN_PHONE.left} top={MAIN_PHONE.top} enter={b.from + 2.3} shots={MAIN_SHOTS}>
        <Screen from={s.login.from} to={s.login.to}>
          <LoginMock />
        </Screen>
        <Screen from={s.home.from} to={s.home.to}>
          <HomeMock />
        </Screen>
        <Screen from={s.start.from} to={s.start.to}>
          <StartMock />
        </Screen>
        <Screen from={s.trip.from} to={s.trip.to} className="bg-azul text-white">
          <TripMock />
        </Screen>
        <Screen from={s.km.from} to={s.km.to}>
          <KmMock />
        </Screen>
        <Screen from={s.fuel.from} to={s.fuel.to}>
          <FuelMock />
        </Screen>
        <Screen from={s.sign.from} to={s.sign.to}>
          <SignMock />
        </Screen>
        <Screen from={s.done.from} to={s.done.to} exit={false}>
          <DoneMock />
        </Screen>
      </PhoneRig>
    </>
  );
}

const NAV_W = 118;
const NAV_LABELS = { login: 'Entrada', home: 'Frota', start: 'Saída', trip: 'Em viagem', km: 'Retorno', fuel: 'Abastecer', sign: 'Assinatura', done: 'Pronto' };

/** Etapas da jornada no topo, com a barra verde deslizando para a etapa atual. */
function JourneyNav() {
  const steps = Object.entries(MAIN.screens).map(([key, beat]) => ({ key, beat, label: NAV_LABELS[key as keyof typeof NAV_LABELS] }));
  const times: number[] = [steps[0].beat.from];
  const xs: number[] = [0];
  steps.slice(1).forEach((step, i) => {
    times.push(step.beat.from - 0.25, step.beat.from + 0.35);
    xs.push(i * NAV_W, (i + 1) * NAV_W);
  });
  const x = useKeys(times, xs, ease.inOut);
  const active = useIs((t) => steps.reduce((acc, step, i) => (t >= step.beat.from - 0.25 ? i : acc), 0));
  const opacity = useKeys([MAIN.screens.login.from + 2, MAIN.screens.login.from + 2.6, MAIN.screens.done.to - 1, MAIN.screens.done.to - 0.4], [0, 1, 1, 0], ease.linear);
  return (
    <m.div className="absolute top-[86px] left-[150px] text-white" style={{ opacity }}>
      <div className="relative mb-3 h-[5px] rounded-full bg-white/15" style={{ width: NAV_W * steps.length - 14 }}>
        <m.span className="absolute top-0 left-0 h-full rounded-full bg-verde" style={{ x, width: NAV_W - 14 }} />
      </div>
      <div className="flex">
        {steps.map((step, i) => (
          <span key={step.key} className={`truncate pr-2 text-[15px] ${i === active ? 'font-bold' : 'opacity-60'}`} style={{ width: NAV_W }}>
            {step.label}
          </span>
        ))}
      </div>
    </m.div>
  );
}

const WINDOW = { scale: 0.8, top: 236 };

function Panorama() {
  const c = { in: 0.2 };
  const y = useTween(c.in, c.in + 1.1, [160, 0], ease.expo);
  const opacity = useTween(c.in, c.in + 0.35, [0, 1]);
  const rotateX = useTween(c.in, c.in + 1.2, [16, 0], ease.soft);
  const fullW = PANEL_W;
  const fullH = PANEL_H + 44;
  const cam = useCamera(
    [
      { t: 1.0, s: 1, fx: fullW / 2, fy: fullH / 2 },
      { t: 1.6, s: 1.1, fx: 720, fy: 420 },
      { t: 3.0, s: 1.1, fx: 720, fy: 420 },
      { t: 3.6, s: 1, fx: fullW / 2, fy: fullH / 2 },
      { t: 5.6, s: 1, fx: fullW / 2, fy: fullH / 2 },
      { t: 6.3, s: 1.08, fx: 720, fy: 470 },
      { t: 8.2, s: 1.08, fx: 720, fy: 470 },
      { t: 8.9, s: 1.1, fx: 1250, fy: 130 },
      { t: 9.7, s: 1, fx: fullW / 2, fy: fullH / 2 },
    ],
    fullW,
    fullH,
  );
  const left = (1920 - fullW * WINDOW.scale) / 2;
  return (
    <>
      <div className="absolute top-[64px] left-[150px] flex items-center gap-6">
        <Reveal at={0.3} y={12} e={ease.expo}>
          <Eyebrow>Gestão</Eyebrow>
        </Reveal>
        <h2 className="text-[60px] leading-none font-bold tracking-[-1.5px]">
          <Words text="A gestão vê tudo, em um só lugar" at={0.45} stagger={0.06} dur={0.6} />
        </h2>
      </div>
      <div className="absolute" style={{ left, top: WINDOW.top, perspective: 2200 }}>
        <m.div style={{ y, opacity, rotateX, scale: WINDOW.scale, originX: 0, originY: 0 }}>
          <m.div style={{ scale: cam.scale, x: cam.x, y: cam.y }} className="overflow-hidden rounded-[18px] bg-cinza shadow-[0_0_0_1.5px_rgb(255_255_255/0.4)_inset]">
            <div className="flex h-11 items-center gap-2 px-4">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-3 rounded-full bg-white/80" />
              ))}
              <span className="mx-auto rounded-full bg-white/80 px-16 py-1 text-[13px] text-azul/70">Painel da Frota · Crefito 11</span>
            </div>
            <AdminPanel />
          </m.div>
        </m.div>
      </div>
    </>
  );
}


function Proof() {
  return (
    <>
      <div className="absolute inset-x-0 top-[150px] flex justify-center">
        <Reveal at={0.2} y={14} e={ease.expo}>
          <Eyebrow size={26}>Benefícios</Eyebrow>
        </Reveal>
      </div>
      <div className="absolute top-[330px] left-[140px] flex gap-10">
        {PROOF.map((item, i) => (
          <ProofCard key={item.title} index={i} at={item.at} title={item.title} text={item.text} nextAt={PROOF[i + 1]?.at} />
        ))}
      </div>
    </>
  );
}

function Close() {
  const dur = MAIN.close.to - MAIN.close.from;
  const fade = useTween(dur - 0.7, dur, [0, 1], ease.inOut);
  return (
    <>
      <Rings cx={960} cy={420} size={1100} at={0.2} />
      <div className="absolute inset-x-0 top-[150px] flex flex-col items-center gap-14">
        <BrandBlock at={0.3} logo={400} title={96} tagline={40} />
        <Contact at={4.2} size={38} />
      </div>
      <m.div className="absolute inset-0 bg-azul" style={{ opacity: fade }} />
    </>
  );
}

/* ---------- 9:16 curta ---------- */

const SHORT_PHONE = { scale: 1.2, top: 640 };

function Short() {
  const { w, h } = SIZES['9x16'];
  const s = SHORT.screens;
  const shots: Shot[] = [
    { t: 0, s: 1, fx: 207, fy: 434 },
    ...shotsFor(s.home, 1.12, 207, 760, 1.2, 1.3),
    ...shotsFor(s.km, 1.1, 207, 270, 0.9, 2.0),
    ...shotsFor(s.sign, 1.1, 207, 600, 0.9, 2.2),
  ];
  const brandOpacity = useKeys([SHORT.brand.to - 1.0, SHORT.brand.to - 0.4], [1, 0], ease.in);
  const brandY = useKeys([SHORT.brand.to - 1.0, SHORT.brand.to - 0.4], [0, -60], ease.in);
  const phoneW = PHONE_W * SHORT_PHONE.scale;
  return (
    <>
      <Backdrop w={w} h={h} />
      <Scene from={SHORT.hook.from} to={SHORT.hook.to}>
        <Cut from={0} to={SHORT.hook.to}>
          <HookQuestion size={120} width={940} />
        </Cut>
      </Scene>
      <RingLayer at={SHORT.brand.from} until={SHORT.close.from + 1.2} cx={540} cy={960} w={w} h={h} seed={1}>
        <Scene from={SHORT.brand.from} to={SHORT.brand.to}>
          <m.div className="absolute inset-x-0 top-[600px] flex justify-center" style={{ opacity: brandOpacity, y: brandY }}>
            <BrandBlock at={0.35} logo={420} title={100} tagline={42} />
          </m.div>
        </Scene>
        {(Object.keys(s) as (keyof typeof s)[]).map((key) => (
          <Scene key={key} from={s[key].from} to={s[key].to}>
            <div className="absolute inset-x-0 top-[300px] flex justify-center">
              <Caption text={SHORT_CAPTIONS[key]} at={0.3} out={s[key].to - s[key].from - 0.5} size={80} align="center" width={920} />
            </div>
          </Scene>
        ))}
        <PhoneRig left={(w - phoneW) / 2} top={SHORT_PHONE.top} scale={SHORT_PHONE.scale} enter={SHORT.brand.to - 0.9} shots={shots}>
          <Screen from={s.home.from} to={s.home.to}>
            <HomeMock />
          </Screen>
          <Screen from={s.km.from} to={s.km.to}>
            <KmMock />
          </Screen>
          <Screen from={s.sign.from} to={s.sign.to}>
            <SignMock />
          </Screen>
        </PhoneRig>
      </RingLayer>
      <RingLayer at={SHORT.close.from} until={SHORT.duration} cx={540} cy={960} w={w} h={h} seed={3}>
        <Scene from={SHORT.close.from} to={SHORT.close.to}>
          <Rings cx={540} cy={760} size={1000} at={0.2} />
          <div className="absolute inset-x-0 top-[470px] flex flex-col items-center gap-20">
            <BrandBlock at={0.3} logo={420} title={96} tagline={42} />
            <Contact at={1.4} size={40} />
          </div>
        </Scene>
      </RingLayer>
    </>
  );
}

/* ---------- 1:1 teaser (loop) ---------- */

function Teaser() {
  const { w, h } = SIZES['1x1'];
  const p = TEASER.phone;
  const scale = 0.86;
  const shots: Shot[] = [
    { t: 0, s: 1, fx: 207, fy: 434 },
    { t: p.from + 1.2, s: 1, fx: 207, fy: 434 },
    { t: p.from + 2.0, s: 1.3, fx: 207, fy: 760 },
    { t: p.to, s: 1.3, fx: 207, fy: 760 },
  ];
  const fade = useTween(TEASER.duration - 0.5, TEASER.duration, [0, 1], ease.inOut);
  return (
    <>
      <Backdrop w={w} h={h} />
      <Scene from={TEASER.hook.from} to={TEASER.hook.to}>
        <Cut from={0} to={TEASER.hook.to}>
          <HookQuestion size={100} width={900} />
        </Cut>
      </Scene>
      <RingLayer at={p.from} until={TEASER.close.from + 1.2} cx={540} cy={540} w={w} h={h} seed={1}>
        <Scene from={p.from} to={p.to}>
          <div className="absolute top-[360px] left-[70px]">
            <Caption text="Agora você sabe." at={0.9} out={p.to - p.from - 0.4} size={80} width={400} />
          </div>
        </Scene>
        <PhoneRig left={720 - (PHONE_W * scale) / 2} top={150} scale={scale} enter={p.from + 0.2} shots={shots}>
          <Screen from={p.from} to={p.to} exit={false}>
            <HomeMock withTap={false} />
          </Screen>
        </PhoneRig>
      </RingLayer>
      <RingLayer at={TEASER.close.from} until={TEASER.duration} cx={540} cy={540} w={w} h={h} seed={3}>
        <Scene from={TEASER.close.from} to={TEASER.close.to}>
          <div className="absolute inset-x-0 top-[200px] flex flex-col items-center gap-12">
            <BrandBlock at={0.25} logo={320} title={80} tagline={34} />
            <Contact at={0.9} size={28} />
          </div>
        </Scene>
      </RingLayer>
      <m.div className="absolute inset-0 bg-azul" style={{ opacity: fade }} />
    </>
  );
}

/* ---------- composição + player ---------- */

export function Video({ time, format, subtitles = false, reduced = false }: { time: MotionValue<number>; format: Format; subtitles?: boolean; reduced?: boolean }) {
  const { w, h } = SIZES[format];
  return (
    <TimeProvider time={time} reduced={reduced}>
      <div className="relative overflow-hidden bg-azul font-sans text-white" style={{ width: w, height: h }}>
        {format === '16x9' && <Main subtitles={subtitles} />}
        {format === '9x16' && <Short />}
        {format === '1x1' && <Teaser />}
      </div>
    </TimeProvider>
  );
}

/**
 * Ao vivo: toca sozinho; espaço pausa, setas pulam 5 s, capítulos clicáveis (16:9).
 * Gravação (?render): o tempo só muda por window.__video.seek(t).
 * Parâmetros: ?formato=16x9|9x16|1x1, ?legendas (narração escrita na tela).
 */
export function Player({ render, format, subtitles }: { render: boolean; format: Format; subtitles: boolean }) {
  const { w, h, duration } = SIZES[format];
  const time = useMotionValue(0);
  const [playing, setPlaying] = useState(!render);
  const [shown, setShown] = useState(0);
  const [scale, setScale] = useState(1);
  const [reduced, setReduced] = useState(false);

  useAnimationFrame((_, delta) => {
    if (!playing) return;
    const next = time.get() + Math.min(delta, 100) / 1000;
    time.set(next >= duration ? 0 : next);
  });
  useMotionValueEvent(time, 'change', (t) => setShown(Math.floor(t * 4) / 4));

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / w, window.innerHeight / h));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [w, h, render]);

  useEffect(() => {
    if (render) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [render]);

  useEffect(() => {
    if (render) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') setPlaying((p) => !p);
      else if (e.key === 'ArrowRight') time.set(Math.min(duration, time.get() + 5));
      else if (e.key === 'ArrowLeft') time.set(Math.max(0, time.get() - 5));
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [render, time, duration]);

  useEffect(() => {
    // flushSync: as trocas discretas (useIs) entram no DOM antes do próximo quadro.
    window.__video = { format, duration, width: w, height: h, audio: AUDIO[format], seek: (t) => flushSync(() => time.set(t)) };
  }, [time, format, duration, w, h]);

  const chapters = format === '16x9' ? CHAPTERS : [];
  const current = chapters.reduce((acc, ch, i) => (shown >= ch.at ? i : acc), 0);

  return (
    <div className="fixed inset-0 overflow-hidden bg-azul">
      <div className="absolute top-1/2 left-1/2" style={{ width: w, height: h, transform: `translate(-50%, -50%) scale(${scale})` }}>
        <Video time={time} format={format} subtitles={subtitles} reduced={reduced} />
      </div>
      {!render && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-azul/90 px-5 pt-3 pb-4 text-white opacity-0 transition-opacity duration-300 hover:opacity-100 focus-within:opacity-100">
          {chapters.length > 0 && (
            <nav aria-label="Capítulos" className="flex flex-wrap gap-1.5">
              {chapters.map((ch, i) => (
                <button
                  key={ch.at}
                  type="button"
                  onClick={() => time.set(ch.at)}
                  aria-current={i === current ? 'true' : undefined}
                  className={`rounded-full px-3 py-1 text-[13px] font-medium ${i === current ? 'bg-verde text-azul' : 'bg-white/10'}`}
                >
                  {ch.label}
                </button>
              ))}
            </nav>
          )}
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setPlaying((p) => !p)} className="w-20 rounded-lg bg-white/10 py-1.5 text-sm font-bold">
              {playing ? 'Pausar' : 'Tocar'}
            </button>
            <div className="relative flex flex-1 items-center">
              <input
                type="range"
                min={0}
                max={duration}
                step={0.01}
                value={shown}
                onChange={(e) => time.set(Number(e.target.value))}
                className="w-full accent-verde"
                aria-label="Posição do vídeo"
              />
              {chapters.map((ch) => (
                <span key={ch.at} aria-hidden="true" className="pointer-events-none absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-white/50" style={{ left: `${(ch.at / duration) * 100}%` }} />
              ))}
            </div>
            <span className="w-24 text-right text-sm tabular-nums">
              {shown.toFixed(1)} / {duration}s
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

declare global {
  interface Window {
    __video?: { format: Format; duration: number; width: number; height: number; audio: (typeof AUDIO)[Format]; seek: (t: number) => void };
  }
}

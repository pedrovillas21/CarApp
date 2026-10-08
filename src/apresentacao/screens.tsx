import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { m, type MotionValue } from 'motion/react';
import {
  IconAlert,
  IconArrowRight,
  IconBackspace,
  IconBolt,
  IconCar,
  IconCheck,
  IconChevronLeft,
  IconClock,
  IconFlag,
  IconFuel,
  IconGauge,
  IconInfo,
  IconLock,
  IconLogout,
  IconPen,
  IconPin,
  IconRotate,
  IconShield,
  IconUser,
} from '../components/Icons';
import { LogoCompleta, LogoTexto } from '../components/Logo';
import { Plate } from '../components/Plate';
import { formatDuration, formatKm } from '../lib/format';
import { Finger, Ring, StatusBar, Tap, usePress } from './phone';
import { CHOREO, DEMO } from './roteiro';
import { clamp01, ease, Reveal, seg, stateAt, useFn, useIs, useKeys, useToggle, useTween } from './timeline';

const { car: CAR, other: OTHER, driver: DRIVER } = DEMO;

/** Digitação por toques: [instante, tecla]. */
function typed(presses: [number, string][], t: number) {
  let value = '';
  for (const [at, key] of presses) {
    if (t < at) break;
    value = key === 'back' ? value.slice(0, -1) : value + key;
  }
  return value;
}

const money = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------- peças comuns ---------- */

function Thumb({ muted = false }: { muted?: boolean }) {
  return (
    <span className={`flex h-[52px] w-[96px] shrink-0 items-center justify-center overflow-hidden ${muted ? 'opacity-55' : ''}`}>
      <img src={CAR.image} alt="" draggable={false} className="size-full object-contain" />
    </span>
  );
}

function TopBarMock({ title, plate = true }: { title: string; plate?: boolean }) {
  return (
    <header className="flex items-center gap-1.5 pt-1 pr-5 pb-1.5 pl-3">
      <span className="flex size-11 items-center justify-center rounded-xl">
        <IconChevronLeft />
      </span>
      <h1 className="flex-1 text-xl font-bold">{title}</h1>
      {plate && <Plate plate={CAR.plate} size="sm" />}
    </header>
  );
}

function StepsMock({ current }: { current: 1 | 2 | 3 }) {
  const steps = ['KM final', 'Abastecimento', 'Assinatura'];
  return (
    <ol className="grid grid-cols-3 gap-2 px-5 pt-1.5">
      {steps.map((label, index) => {
        const step = index + 1;
        return (
          <li key={label} className="flex flex-col gap-1.5">
            <StepBar done={step < current} active={step === current} />
            <span className={`text-[13px] ${step === current ? 'font-bold' : 'text-azul/80'}`}>
              {step} · {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Barra da etapa atual preenche ao entrar na tela. */
function StepBar({ done, active }: { done: boolean; active: boolean }) {
  const fill = useTween(0.25, 0.85, [0, 1], ease.expo);
  return (
    <span className="relative h-[5px] overflow-hidden rounded-full bg-cinza">
      {(done || active) && <m.span className="absolute inset-0 origin-left rounded-full bg-azul" style={{ scaleX: done ? 1 : fill }} />}
    </span>
  );
}

function Spinner() {
  const rotate = useFn((t) => (t * 420) % 360);
  return <m.span className="size-5 rounded-full border-2 border-current border-r-transparent" style={{ rotate }} />;
}

function Caret({ from = 0, to = 999, className = 'h-[38px] w-[3px] bg-verde' }: { from?: number; to?: number; className?: string }) {
  const opacity = useFn((t) => (t < from || t > to ? 0 : Math.floor((t - from) / 0.5) % 2 === 0 ? 1 : 0));
  return <m.span aria-hidden="true" className={`rounded-sm ${className}`} style={{ opacity }} />;
}

/** Botão principal (mesmas classes do Button). Habilitado/desabilitado em crossfade, sem CSS transition. */
function MockButton({ children, icon, enabled = [], initial = true, tapAt, loadingAt, loadingLabel, variant = 'primary', className = '' }: {
  children: ReactNode;
  icon?: ReactNode;
  enabled?: [number, boolean][];
  initial?: boolean;
  tapAt?: number;
  loadingAt?: number;
  loadingLabel?: string;
  variant?: 'primary' | 'accent';
  className?: string;
}) {
  const switches: [number, boolean][] = loadingAt === undefined ? enabled : [...enabled, [loadingAt, false]];
  const on = useToggle(initial, switches);
  const off = useFn((t) => 1 - stateAt(t, initial, switches));
  const loading = useIs((t) => t >= (loadingAt ?? 999));
  const scale = usePress(tapAt ?? 999);
  const look = variant === 'accent' ? 'bg-verde text-azul' : 'bg-azul text-white';
  const content = (
    <>
      {loading ? <Spinner /> : icon}
      <span>{loading ? loadingLabel : children}</span>
    </>
  );
  return (
    <m.div style={{ scale }} className={`relative h-14 w-full rounded-[14px] text-[17px] font-bold ${className}`}>
      <m.span style={{ opacity: on }} className={`absolute inset-0 flex items-center justify-center gap-2.5 rounded-[14px] px-4 ${look}`}>
        {content}
      </m.span>
      <m.span style={{ opacity: off }} className="absolute inset-0 flex items-center justify-center gap-2.5 rounded-[14px] bg-cinza px-4 text-azul/60">
        {content}
      </m.span>
      {tapAt !== undefined && <Tap at={tapAt} />}
    </m.div>
  );
}

/** Cartão selecionável: a borda azul e o fundo verde entram em crossfade por cima da borda cinza. */
function Selectable({ on, radius, className, children }: { on: MotionValue<number> | number; radius: number; className: string; children: ReactNode }) {
  return (
    <div className={`relative border-2 border-cinza bg-white ${className}`} style={{ borderRadius: radius }}>
      <m.span aria-hidden="true" className="absolute -inset-[2px] border-2 border-azul bg-verde/10" style={{ opacity: on, borderRadius: radius }} />
      {children}
    </div>
  );
}

function CheckBadge({ at, size = 24, on }: { at?: number; size?: number; on?: MotionValue<number> }) {
  const pop = useTween(at ?? -1, (at ?? -1) + 0.45, [0, 1], ease.pop);
  return (
    <m.span
      className="absolute top-3 right-3 z-10 flex items-center justify-center rounded-full bg-verde"
      style={{ width: size, height: size, scale: at === undefined ? 1 : pop, opacity: on ?? 1 }}
    >
      <IconCheck size={size * 0.58} strokeWidth={3} />
    </m.span>
  );
}

/* ---------- Entrada (login) ---------- */

export function LoginMock() {
  const c = CHOREO.login;
  const dots = useIs((t) => Math.max(0, Math.min(6, Math.floor((t - c.pwd[0]) / ((c.pwd[1] - c.pwd[0]) / 5)) + 1)));
  const pwdFocus = useToggle(false, [
    [c.pwd[0] - 0.3, true],
    [c.tap - 0.15, false],
  ]);
  const formY = useTween(0.15, 0.75, [18, 0], ease.expo);
  return (
    <>
      <div className="bg-azul">
        <StatusBar time="10:21" dark />
      </div>
      <section className="flex flex-col gap-7 rounded-b-[32px] bg-azul px-7 pt-3 pb-24">
        <LogoCompleta width={220} />
        <div className="flex flex-col gap-3">
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-verde/15 px-3 py-1.5 text-[13px] font-bold tracking-[0.6px] text-verde uppercase">
            <IconCar size={16} />
            Frota oficial
          </span>
          <h1 className="text-[34px] leading-[1.1] font-bold text-white">Controle de Frota</h1>
          <p className="max-w-[290px] text-base leading-[1.45] text-white/80">Registre a saída e o retorno dos carros do conselho.</p>
        </div>
      </section>
      <m.div style={{ y: formY }} className="mx-5 -mt-16 flex flex-col gap-[18px] rounded-3xl bg-white p-6 shadow-[0_14px_36px_rgb(46_47_113/0.16)]">
        <h2 className="text-[22px] font-bold">Entrar</h2>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">E-mail</span>
          <div className="relative flex h-[54px] items-center rounded-[14px] border-[1.5px] border-cinza bg-white pr-4 pl-12 text-base">
            <IconUser className="absolute left-4 text-azul/60" />
            {DRIVER.email}
            <Ring from={c.pwd[0] - 0.1} to={c.tap - 0.3} radius={16} inset={-6} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Senha</span>
          <div className="relative flex h-[54px] items-center rounded-[14px] border-[1.5px] border-cinza bg-white pr-14 pl-12 text-base">
            <m.span aria-hidden="true" className="absolute -inset-[1.5px] rounded-[14px] border-[1.5px] border-azul" style={{ opacity: pwdFocus }} />
            <IconLock className="absolute left-4 text-azul/60" />
            {dots ? <span className="text-[22px] leading-none tracking-[3px]">{'•'.repeat(dots)}</span> : <span className="text-azul/60">sua senha</span>}
            <Caret from={c.pwd[0] - 0.3} to={c.tap - 0.15} className="ml-0.5 h-[22px] w-[2px] bg-azul" />
          </div>
        </div>
        <span className="flex min-h-11 items-center gap-3 text-[15px]">
          <span className="flex size-5 items-center justify-center rounded-[5px] bg-azul text-white">
            <IconCheck size={14} strokeWidth={3} />
          </span>
          Lembrar meu e-mail
        </span>
        <MockButton tapAt={c.tap} loadingAt={c.loading} loadingLabel="Entrando…">
          <span className="inline-flex items-center gap-2.5">
            Entrar <IconArrowRight />
          </span>
        </MockButton>
      </m.div>
      <p className="mx-7 mt-auto flex items-start gap-2.5 pt-6 pb-8 text-[13px] leading-normal text-azul/80">
        <IconShield size={18} className="mt-px shrink-0" />
        <span>Acesso só para condutores cadastrados. Esqueceu a senha? Fale com a administração.</span>
      </p>
    </>
  );
}

/* ---------- Início (frota) ---------- */

export function HomeMock({ withTap = true }: { withTap?: boolean }) {
  const c = CHOREO.home;
  const cardY = useTween(0.2, 0.8, [18, 0], ease.expo);
  const cardOpacity = useTween(0.2, 0.6, [0, 1]);
  const press = usePress(withTap ? c.tap : 999);
  return (
    <>
      <div className="bg-azul">
        <StatusBar time="10:22" dark />
      </div>
      <header className="flex flex-col gap-7 rounded-b-[28px] bg-azul px-5 pt-1 pb-[84px]">
        <div className="flex items-center justify-between">
          <div className="py-2">
            <LogoTexto height={24} />
          </div>
          <span className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-white">
            <IconLogout />
          </span>
        </div>
        <div className="flex items-center gap-3.5">
          <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-verde text-lg font-bold text-azul">{DRIVER.initials}</span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[26px] font-bold text-white">Olá, {DRIVER.first}</span>
            <span className="text-[15px] text-white/80">Quarta-feira, 7 de outubro</span>
          </div>
        </div>
      </header>

      <m.div
        style={{ y: cardY, opacity: cardOpacity, scale: press }}
        className="relative mx-5 -mt-14 flex items-center gap-4 rounded-[20px] bg-verde p-5 text-left text-azul shadow-[0_12px_28px_rgb(46_47_113/0.2)]"
      >
        <span className="flex flex-1 flex-col gap-1">
          <span className="text-[22px] font-bold">Iniciar viagem</span>
          <span className="text-[15px] leading-[1.4]">Escolha o carro e registre a saída</span>
        </span>
        <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-azul text-white">
          <IconArrowRight size={22} />
        </span>
        {withTap && <Tap at={c.tap} dx={129} />}
      </m.div>

      <section className="flex flex-col gap-3 px-5 pt-7">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">Frota</h2>
          <span className="text-sm text-azul/80">1 de 2 disponíveis</span>
        </div>
        <Reveal at={0.35} y={16} e={ease.expo} className="flex flex-col gap-3 rounded-2xl border border-cinza bg-white px-4 py-3.5">
          <div className="flex items-center gap-3.5">
            <Thumb />
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="text-base leading-snug font-bold">{CAR.model}</span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-azul/80 tabular-nums">
                <Plate plate={CAR.plate} size="sm" />
                {formatKm(CAR.km)} km
              </span>
            </div>
            <span className="rounded-full bg-verde px-2.5 py-1.5 text-[13px] font-bold">Disponível</span>
          </div>
        </Reveal>
        <Reveal at={0.5} y={16} e={ease.expo} className="flex flex-col gap-3 rounded-2xl border border-cinza bg-white px-4 py-3.5">
          <div className="flex items-center gap-3.5">
            <Thumb muted />
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="text-base leading-snug font-bold">{OTHER.model}</span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-azul/80 tabular-nums">
                <Plate plate={OTHER.plate} size="sm" />
                {formatKm(OTHER.km)} km
              </span>
            </div>
            <span className="rounded-full bg-laranja px-2.5 py-1.5 text-[13px] font-bold">Em uso</span>
          </div>
          <div className="relative flex flex-col gap-2 rounded-xl bg-laranja/20 p-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-laranja text-[15px] font-bold">{DEMO.otherDriver.initials}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-xs font-medium tracking-[0.4px] text-azul/80 uppercase">Com</span>
                <span className="text-base leading-tight font-bold">{DEMO.otherDriver.short}</span>
              </span>
            </div>
            <span className="flex items-center gap-2 text-sm tabular-nums">
              <IconClock size={16} strokeWidth={2.2} className="shrink-0" />
              Saiu às 08:52 · há 1h 30min
            </span>
            <Ring from={c.glow[0]} to={c.glow[1]} radius={16} />
          </div>
        </Reveal>
      </section>
    </>
  );
}

/* ---------- Saída ---------- */

export function StartMock() {
  const c = CHOREO.start;
  const viewport = useRef<HTMLDivElement>(null);
  const kmSection = useRef<HTMLElement>(null);
  const toKm = useRef(0);
  useLayoutEffect(() => {
    const vp = viewport.current;
    const km = kmSection.current;
    if (vp && km) toKm.current = Math.max(0, km.offsetTop + km.offsetHeight - vp.clientHeight + 16);
  });
  const y = useFn((t) => -toKm.current * seg(t, c.scroll[0], c.scroll[1], ease.inOut));

  const fuelOn = useToggle(false, [[c.tapFuel, true]]);
  const normalOn = useFn((t) => 1 - stateAt(t, false, [[c.tapFuel, true]]));
  const pressFuel = usePress(c.tapFuel);
  const hintOpacity = useTween(c.tapFuel, c.tapFuel + 0.25, [1, 0]);
  const infoOpacity = useTween(c.tapFuel + 0.1, c.tapFuel + 0.45, [0, 1]);
  const infoY = useTween(c.tapFuel + 0.1, c.tapFuel + 0.5, [8, 0], ease.expo);
  // A placa "encaixa" no cartão do carro.
  const plateY = useTween(c.plate, c.plate + 0.5, [-14, 0], ease.pop);
  const plateScale = useTween(c.plate, c.plate + 0.5, [1.25, 1], ease.pop);
  const plateOpacity = useTween(c.plate, c.plate + 0.12, [0, 1]);

  return (
    <>
      <StatusBar time="10:24" />
      <TopBarMock title="Iniciar viagem" plate={false} />
      <div ref={viewport} className="relative min-h-0 flex-1 overflow-hidden">
        <m.div style={{ y }} className="relative flex flex-col gap-[22px] px-5 pt-2 pb-5">
          <section className="flex flex-col gap-2.5">
            <h2 className="text-base font-bold">1. Escolha o carro</h2>
            <Selectable on={1} radius={16} className="flex w-full items-center gap-3.5 px-3.5 py-3">
              <span className="relative z-10 flex w-full items-center gap-3.5">
                <Thumb />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-base leading-snug font-bold">{CAR.model}</span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-azul/80 tabular-nums">
                    <m.span style={{ y: plateY, scale: plateScale, opacity: plateOpacity }} className="inline-flex">
                      <Plate plate={CAR.plate} size="sm" />
                    </m.span>
                    {formatKm(CAR.km)} km
                  </span>
                </span>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-verde">
                  <IconCheck size={16} strokeWidth={3} />
                </span>
              </span>
              <Ring from={c.carGlow[0]} to={c.carGlow[1]} radius={18} inset={-7} />
            </Selectable>
            <div className="flex items-center gap-3.5 rounded-2xl border-2 border-dashed border-cinza px-3.5 py-3">
              <Thumb muted />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base leading-snug font-bold">{OTHER.model}</span>
                <span className="self-start">
                  <Plate plate={OTHER.plate} size="sm" muted />
                </span>
              </div>
              <span className="rounded-full bg-laranja px-2.5 py-1.5 text-[13px] font-bold">Em uso</span>
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <h2 className="text-base font-bold">2. Tipo de viagem</h2>
            <div className="grid grid-cols-2 gap-2.5">
              <TripType on={normalOn} icon={<IconCar size={24} />} iconBg="bg-azul-claro/35" title="Viagem normal" description="Serviço, entrega ou visita" />
              <TripType
                on={fuelOn}
                checkAt={c.tapFuel}
                icon={<IconFuel size={24} />}
                iconBg="bg-laranja/35"
                title="Abastecimento"
                description="Ir ao posto ou recarregar"
                scale={pressFuel}
                tapAt={c.tapFuel}
              />
            </div>
            <div className="grid">
              <m.p style={{ opacity: hintOpacity }} className="[grid-area:1/1] text-[13px] leading-[1.45] text-azul/80">
                Se abastecer no caminho, dá para informar o valor no retorno.
              </m.p>
              <m.div
                style={{ opacity: infoOpacity, y: infoY }}
                className="flex items-start gap-2.5 self-start rounded-[14px] bg-laranja/20 px-3.5 py-3 text-sm leading-[1.45] [grid-area:1/1]"
              >
                <IconInfo size={18} strokeWidth={2.2} className="mt-px shrink-0" />
                <span>
                  No retorno, você vai informar <strong>o que abasteceu e o valor</strong>. Guarde o comprovante.
                </span>
              </m.div>
            </div>
          </section>

          <section ref={kmSection} className="flex flex-col gap-2.5">
            <h2 className="text-base font-bold">3. Confira o KM inicial</h2>
            <div className="relative flex items-center gap-3.5 rounded-2xl bg-cinza/55 px-4 py-3.5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white">
                <IconGauge size={22} />
              </span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-medium">KM inicial registrado</span>
                <span className="text-[28px] font-bold tabular-nums">{formatKm(CAR.km)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
                <IconLock size={14} strokeWidth={2.4} />
                Automático
              </span>
              <Ring from={c.kmGlow[0]} to={c.kmGlow[1]} radius={20} />
            </div>
            <p className="text-[13px] leading-[1.45] text-azul/80">Vem do último retorno deste carro. Não precisa digitar.</p>
          </section>

          <section className="flex flex-col gap-2.5">
            <span className="text-base font-bold">
              4. Destino ou motivo <span className="font-normal text-azul/80">(opcional)</span>
            </span>
            <div className="relative flex h-[54px] w-full items-center rounded-[14px] border-[1.5px] border-cinza bg-white pr-4 pl-12 text-base">
              <IconPin className="absolute left-4 text-azul/60" />
              <span className="text-azul/60">Ex.: posto ou eletroposto</span>
            </div>
          </section>
        </m.div>
      </div>
      <footer className="flex flex-col gap-2.5 border-t border-cinza bg-white px-5 pt-3 pb-6">
        <MockButton icon={<IconClock />} tapAt={c.tap} loadingAt={c.loading} loadingLabel="Registrando saída…">
          Iniciar viagem
        </MockButton>
        <span className="text-center text-[13px] text-azul/80">O cronômetro começa quando você confirmar.</span>
      </footer>
    </>
  );
}

function TripType({ on, icon, iconBg, title, description, scale, tapAt, checkAt }: {
  on: MotionValue<number>;
  icon: ReactNode;
  iconBg: string;
  title: string;
  description: string;
  scale?: MotionValue<number>;
  tapAt?: number;
  checkAt?: number;
}) {
  return (
    <m.div style={{ scale }} className="relative">
      <Selectable on={on} radius={16} className="flex min-h-32 flex-col items-start gap-2.5 p-3.5 text-left">
        <span className={`relative z-10 flex size-11 items-center justify-center rounded-xl ${iconBg}`}>{icon}</span>
        <span className="relative z-10 flex flex-col gap-0.5">
          <span className="text-base font-bold">{title}</span>
          <span className="text-[13px] leading-[1.35] text-azul/80">{description}</span>
        </span>
        {checkAt !== undefined ? <CheckBadge at={checkAt} /> : <CheckBadge on={on} />}
      </Selectable>
      {tapAt !== undefined && <Tap at={tapAt} />}
    </m.div>
  );
}

/* ---------- Em viagem ---------- */

export const FAST_FORWARD = 4357; // 1h12min37s

/** Tempo mostrado: 1x, avança até 1h12 (simula a manhã passando), depois 1x de novo. */
export const elapsedAt = (t: number) => {
  const [a, b] = CHOREO.trip.ff;
  return t <= a ? Math.max(0, t) : t <= b ? a + (FAST_FORWARD - a) * ease.inOut((t - a) / (b - a)) : FAST_FORWARD + (t - b);
};

const clockAt = (seconds: number) => {
  const total = 10 * 3600 + 24 * 60 + Math.floor(seconds);
  return `${Math.floor(total / 3600)}:${String(Math.floor((total % 3600) / 60)).padStart(2, '0')}`;
};

export function TripMock() {
  const c = CHOREO.trip;
  const timer = useFn((t) => formatDuration(elapsedAt(t) * 1000));
  const clock = useFn((t) => clockAt(elapsedAt(t)));
  const ringPhase = (t: number) => (t % 2.4) / 2.4;
  const ringScale = useFn((t) => 1 + 0.14 * ease.out(ringPhase(t)));
  const ringOpacity = useFn((t) => 0.7 * (1 - ringPhase(t)));
  const blink = useFn((t) => 0.725 + 0.275 * Math.cos((2 * Math.PI * t) / 1.6));
  const ffGlow = useKeys([c.ff[0] - 0.1, c.ff[0] + 0.2, c.ff[1], c.ff[1] + 0.4], [0, 1, 1, 0], [ease.out, ease.linear, ease.in]);
  // Cada segundo "bate" de leve no número (tique do cronômetro).
  const tick = useFn((t) => {
    if (t > c.ff[0] && t < c.ff[1]) return 1;
    const frac = elapsedAt(t) % 1;
    return 1 + 0.025 * Math.max(0, 1 - frac / 0.18);
  });

  return (
    <>
      <StatusBar time={clock} dark />
      <header className="flex items-center justify-between px-5 pt-1">
        <div className="py-2">
          <LogoTexto height={24} />
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-verde/15 px-3.5 py-2 text-[13px] font-bold tracking-[0.4px] text-verde uppercase">
          <m.span className="size-2 rounded-full bg-verde" style={{ opacity: blink }} />
          Em viagem
        </span>
      </header>

      <section className="flex flex-1 items-center justify-center py-6">
        <div className="relative flex size-[300px] items-center justify-center">
          <m.span className="absolute inset-0 rounded-full border-2 border-verde" style={{ scale: ringScale, opacity: ringOpacity }} />
          <span className="absolute inset-0 rounded-full border-2 border-verde/40" />
          <span className="absolute inset-5 rounded-full bg-white/[0.06]" />
          <m.span className="absolute inset-5 rounded-full bg-verde/15" style={{ opacity: ffGlow }} />
          <div className="relative flex flex-col items-center gap-2">
            <span className="text-[13px] font-medium tracking-[0.6px] text-white/80 uppercase">Tempo de viagem</span>
            <m.span className="text-[51px] font-bold tracking-[-1px] tabular-nums" style={{ scale: tick }}>
              {timer}
            </m.span>
            <span className="text-[15px] text-white/80">Saída às 10:24</span>
          </div>
        </div>
      </section>

      <Reveal at={0.25} y={14} e={ease.expo} className="mx-5 flex flex-col rounded-[20px] bg-white/[0.08] px-[18px] py-1">
        <InfoRow icon={<IconCar />} label="Veículo">
          <span className="font-bold">{CAR.model}</span>
          <Plate plate={CAR.plate} size="sm" onDark />
        </InfoRow>
        <InfoRow icon={<IconGauge />} label="KM inicial" divider>
          <span className="font-bold tabular-nums">{formatKm(CAR.km)} km</span>
        </InfoRow>
        <InfoRow icon={<IconFuel />} label="Tipo" divider>
          <span className="font-bold">Abastecimento</span>
        </InfoRow>
      </Reveal>

      <footer className="flex flex-col gap-3 px-5 pt-5 pb-7">
        <MockButton variant="accent" icon={<IconFlag />} tapAt={c.tap} className="h-[58px]">
          Finalizar viagem
        </MockButton>
        <span className="text-center text-[13px] leading-[1.4] text-white/80">Ao devolver o carro, informe o KM do painel, o valor abastecido e assine.</span>
      </footer>
    </>
  );
}

function InfoRow({ icon, label, divider = false, children }: { icon: ReactNode; label: string; divider?: boolean; children: ReactNode }) {
  return (
    <div className={`flex items-center gap-3 py-3.5 ${divider ? 'border-t border-white/[0.12]' : ''}`}>
      <span className="flex text-verde">{icon}</span>
      <span className="flex-1 text-sm text-white/80">{label}</span>
      <span className="flex items-center gap-2 text-[15px]">{children}</span>
    </div>
  );
}

/* ---------- KM final ---------- */

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const;

export function KmMock() {
  const c = CHOREO.km;
  const validAt = c.keys[3][0];
  const errorAt = c.keys[4][0];
  const backAt = c.keys[5][0];
  const digits = useIs((t) => typed(c.keys, t));
  const km = digits ? Number(digits) : 0;
  const diff = km - CAR.km;
  const tooHigh = diff > 5000;
  const valid = digits.length >= 4 && diff >= 0 && !tooHigh;
  const validSince = (t: number) => (t >= backAt ? backAt : validAt);
  // "+82 km rodados": o número sobe como contador, com o selo pulando.
  const driven = useFn((t) => `+${Math.round((KM_DRIVEN * ease.out(clamp01((t - validSince(t)) / 0.6))))} km rodados`);
  const chipScale = useFn((t) => 0.6 + 0.4 * ease.pop(clamp01((t - validSince(t)) / 0.5)));
  const coral = useToggle(false, [
    [errorAt, true],
    [backAt, false],
  ]);
  const shake = useFn((t) => (t >= errorAt && t <= errorAt + 0.5 ? Math.sin((t - errorAt) * 60) * 9 * (1 - (t - errorAt) / 0.5) : 0));

  return (
    <>
      <StatusBar time="11:37" />
      <TopBarMock title="Retorno do veículo" />
      <StepsMock current={1} />

      <section className="flex flex-col gap-3 px-5 pt-5">
        <m.div style={{ x: shake }} className="relative flex flex-col gap-2.5 rounded-[20px] border-2 border-azul px-5 py-[18px]">
          <m.span aria-hidden="true" className="absolute -inset-[2px] rounded-[20px] border-2 border-coral" style={{ opacity: coral }} />
          <span className="text-sm font-medium">KM final no painel</span>
          <div className="flex min-h-[52px] items-center gap-1.5">
            <span className="text-[44px] font-bold tracking-[-0.5px] tabular-nums">{digits ? formatKm(km) : ''}</span>
            <Caret />
            <span className="ml-auto text-lg font-medium text-azul/80">km</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-cinza/70 px-2.5 py-1.5 text-[13px] font-medium tabular-nums">Inicial {formatKm(CAR.km)}</span>
            {valid && (
              <m.span style={{ scale: chipScale }} className="rounded-full bg-verde px-2.5 py-1.5 text-[13px] font-bold tabular-nums">
                {driven}
              </m.span>
            )}
          </div>
        </m.div>
        {!digits && <p className="text-sm text-azul/80">Digite o número que aparece no hodômetro.</p>}
        {tooHigh && (
          <Reveal at={errorAt} dur={0.3} y={8} e={ease.expo} className="flex items-start gap-3 rounded-[14px] border-[1.5px] border-coral bg-coral/10 px-4 py-3.5 text-sm leading-[1.45]">
            <span className="flex shrink-0 text-coral">
              <IconAlert />
            </span>
            <span className="flex-1">Mais de 5.000 km rodados? Confira o hodômetro: parece ter um dígito a mais.</span>
          </Reveal>
        )}
      </section>

      <div className="mt-auto grid grid-cols-3 gap-2.5 px-5 pt-4">
        {KEYS.map((key) => (
          <Key key={key} label={key} presses={c.keys.filter(([, k]) => k === key).map(([at]) => at)} />
        ))}
      </div>

      <footer className="px-5 pt-4 pb-6">
        <MockButton
          initial={false}
          enabled={[
            [validAt, true],
            [errorAt, false],
            [backAt, true],
          ]}
          tapAt={c.tap}
        >
          <span className="inline-flex items-center gap-2.5">
            Continuar <IconArrowRight />
          </span>
        </MockButton>
      </footer>
    </>
  );
}

const KM_DRIVEN = DEMO.kmEnd - DEMO.car.km;

function Key({ label, presses }: { label: (typeof KEYS)[number]; presses: number[] }) {
  const scale = useFn((t) => {
    let s = 1;
    for (const at of presses) {
      if (t >= at - 0.02 && t <= at + 0.3) s = Math.min(s, t < at + 0.08 ? 1 - 0.06 * seg(t, at - 0.02, at + 0.08, ease.out) : 0.94 + 0.06 * seg(t, at + 0.08, at + 0.3, ease.out));
    }
    return s;
  });
  return (
    <m.div style={{ scale }} className={`relative flex h-[60px] items-center justify-center rounded-[14px] bg-cinza/60 font-bold ${label === 'clear' ? 'text-[17px]' : 'text-[26px]'}`}>
      {label === 'back' ? <IconBackspace /> : label === 'clear' ? 'Limpar' : label}
      {presses.map((at) => (
        <Tap key={at} at={at} />
      ))}
    </m.div>
  );
}

/* ---------- Abastecimento ---------- */

export function FuelMock() {
  const c = CHOREO.fuel;
  const bothOn = useToggle(false, [[c.tapBoth, true]]);
  const pressBoth = usePress(c.tapBoth);
  const gas = useIs((t) => typed(c.gas, t));
  const ele = useIs((t) => typed(c.ele, t));
  const gasFocus = useToggle(false, [
    [c.gasTap, true],
    [c.eleTap, false],
  ]);
  const eleFocus = useToggle(false, [[c.eleTap, true]]);
  const hintOpacity = useTween(c.tapBoth, c.tapBoth + 0.25, [1, 0]);
  const total = useFn((t) => `R$ ${money((DEMO.gas + DEMO.electric) * ease.out(clamp01((t - c.total) / 0.6)))}`);
  const lastKey = c.ele[c.ele.length - 1][0];

  return (
    <>
      <StatusBar time="11:37" />
      <TopBarMock title="Retorno do veículo" />
      <StepsMock current={2} />

      <section className="flex flex-col gap-[22px] px-5 pt-[22px]">
        <span className="inline-flex items-center gap-2 self-start rounded-full bg-laranja/35 py-[7px] pr-3 pl-2.5 text-[13px] font-bold">
          <IconFuel size={16} strokeWidth={2.2} />
          Viagem de abastecimento
        </span>

        <div className="flex flex-col gap-2.5">
          <h2 className="text-base font-bold">O que você abasteceu?</h2>
          <div className="grid grid-cols-3 gap-2">
            <FuelOption label="Gasolina" icon={<IconFuel size={24} />} />
            <FuelOption label="Eletricidade" icon={<IconBolt size={24} />} />
            <FuelOption
              label="Os dois"
              on={bothOn}
              scale={pressBoth}
              tapAt={c.tapBoth}
              icon={
                <span className="flex items-center gap-0.5">
                  <IconFuel size={20} strokeWidth={2.2} />
                  <IconBolt size={20} strokeWidth={2.2} />
                </span>
              }
            />
          </div>
        </div>

        <div className="relative flex flex-col gap-[22px]">
          <m.p style={{ opacity: hintOpacity }} className="absolute inset-x-0 -top-3 text-[13px] leading-[1.45] text-azul/80">
            Obrigatório nesta viagem: escolha o que abasteceu e informe o valor do comprovante.
          </m.p>
          <Reveal at={c.tapBoth + 0.15} y={16} e={ease.expo}>
            <MoneyField label="Valor da gasolina" value={gas} focus={gasFocus} tapAt={c.gasTap} />
          </Reveal>
          <Reveal at={c.tapBoth + 0.27} y={16} e={ease.expo}>
            <MoneyField label="Valor da recarga elétrica" value={ele} focus={eleFocus} tapAt={c.eleTap} />
          </Reveal>
          <Reveal at={c.total} y={12} e={ease.expo} scale={0.96}>
            <div className="flex items-center justify-between rounded-[14px] bg-cinza/55 px-4 py-3.5">
              <span className="text-sm font-medium">Total abastecido</span>
              <m.span className="text-xl font-bold tabular-nums">{total}</m.span>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="mt-auto px-5 pt-6 pb-6">
        <MockButton initial={false} enabled={[[lastKey, true]]} tapAt={c.tap}>
          <span className="inline-flex items-center gap-2.5">
            Continuar para assinatura <IconArrowRight />
          </span>
        </MockButton>
      </footer>
    </>
  );
}

function FuelOption({ label, icon, on = 0, scale, tapAt }: {
  label: string;
  icon: ReactNode;
  on?: MotionValue<number> | number;
  scale?: MotionValue<number>;
  tapAt?: number;
}) {
  return (
    <m.div style={{ scale }} className="relative">
      <Selectable on={on} radius={14} className="flex min-h-[84px] flex-col items-center justify-center gap-2 px-1.5 py-2.5 text-sm font-bold">
        <span className="relative z-10 flex flex-col items-center gap-2">
          {icon}
          {label}
        </span>
      </Selectable>
      {tapAt !== undefined && <Tap at={tapAt} />}
    </m.div>
  );
}

function MoneyField({ label, value, focus, tapAt }: { label: string; value: string; focus: MotionValue<number>; tapAt: number }) {
  const shown = value ? money(Number(value) / 100) : '0,00';
  return (
    <div className="flex flex-col gap-2">
      <span className="text-base font-bold">{label}</span>
      <div className="relative flex h-[60px] items-center gap-2 rounded-[14px] border-2 border-azul bg-white px-4">
        <m.span aria-hidden="true" className="absolute -inset-[5px] rounded-[18px] border-[3px] border-verde/50" style={{ opacity: focus }} />
        <span className="text-lg font-medium text-azul/80">R$</span>
        <span className={`text-[26px] font-bold tabular-nums ${value ? '' : 'text-azul/60'}`}>{shown}</span>
        <m.span style={{ opacity: focus }} className="flex">
          <Caret className="h-[30px] w-[2px] bg-azul" />
        </m.span>
        <Tap at={tapAt} dx={40} />
      </div>
    </div>
  );
}

/* ---------- Assinatura ---------- */

export const SIGNATURE_PATHS = {
  main: 'M 56 150 C 44 112, 96 96, 100 124 C 104 146, 62 196, 50 178 C 38 160, 112 140, 130 150 C 142 157, 130 186, 142 180 C 154 174, 158 140, 168 138 C 178 136, 170 182, 184 178 C 198 174, 202 118, 214 114 C 224 111, 216 180, 228 182 C 240 184, 248 150, 260 148 C 274 146, 264 178, 278 176 C 292 174, 298 156, 314 150',
  under: 'M 74 196 C 150 188, 232 186, 304 180',
  w: 346,
  h: 246,
};

export function SignMock() {
  const c = CHOREO.sign;
  const main = useRef<SVGPathElement>(null);
  const under = useRef<SVGPathElement>(null);
  const lengths = useRef({ main: 1, under: 1 });
  useLayoutEffect(() => {
    if (main.current && under.current) lengths.current = { main: main.current.getTotalLength(), under: under.current.getTotalLength() };
  });
  const mainProgress = (t: number) => seg(t, c.draw[0], c.draw[1], ease.inOut);
  const underProgress = (t: number) => seg(t, c.under[0], c.under[1], ease.out);
  const drawMain = useFn(mainProgress);
  const drawUnder = useFn(underProgress);
  const mainOpacity = useFn((t) => (mainProgress(t) > 0 ? 1 : 0));
  const underOpacity = useFn((t) => (underProgress(t) > 0 ? 1 : 0));
  const point = (t: number) => {
    const useUnder = t >= c.under[0] - 0.04;
    const path = useUnder ? under.current : main.current;
    if (!path) return { x: 0, y: 0 };
    const p = useUnder ? underProgress(t) : mainProgress(t);
    return path.getPointAtLength(p * (useUnder ? lengths.current.under : lengths.current.main));
  };
  const fx = useFn((t) => point(t).x);
  const fy = useFn((t) => point(t).y);
  const fingerOpacity = useKeys([c.draw[0] - 0.35, c.draw[0] - 0.1, c.under[1], c.under[1] + 0.3], [0, 1, 1, 0], [ease.out, ease.linear, ease.out]);
  const placeholder = useTween(c.draw[0], c.draw[0] + 0.2, [1, 0]);
  const clear = useTween(c.draw[0] + 0.1, c.draw[0] + 0.4, [0, 1]);

  return (
    <>
      <StatusBar time="11:38" />
      <TopBarMock title="Assinatura" />
      <StepsMock current={3} />

      <section className="flex flex-col gap-3.5 px-5 pt-[18px]">
        <Reveal at={0.15} y={12} e={ease.expo} className="flex flex-col rounded-2xl border border-cinza px-4 py-1">
          <span className="pt-3 pb-1 text-[13px] font-medium text-azul/80">Você confirma a devolução de:</span>
          <SummaryRow label="Veículo" value={`${CAR.model} · ${CAR.plate}`} />
          <SummaryRow label="Quilometragem" value={`${formatKm(CAR.km)} → ${formatKm(DEMO.kmEnd)} km`} />
          <SummaryRow label="Abastecimento" value={`Gasolina R$ ${money(DEMO.gas)} + Eletricidade R$ ${money(DEMO.electric)}`} />
          <SummaryRow label="Condutor" value={DRIVER.name} last />
        </Reveal>

        <div className="relative overflow-hidden rounded-[20px] border-2 border-dashed border-azul/30 bg-white" style={{ height: SIGNATURE_PATHS.h + 4 }}>
          <span className="absolute right-6 bottom-[62px] left-6 h-0.5 bg-cinza" />
          <span className="absolute bottom-[68px] left-7 text-lg leading-none font-bold text-azul/45">×</span>
          <m.span style={{ opacity: placeholder }} className="absolute right-0 bottom-[30px] left-0 text-center text-sm text-azul/80">
            Assine aqui com o dedo
          </m.span>
          <svg width={SIGNATURE_PATHS.w} height={SIGNATURE_PATHS.h} viewBox={`0 0 ${SIGNATURE_PATHS.w} ${SIGNATURE_PATHS.h}`} fill="none" className="absolute top-0 left-0">
            <m.path ref={main} d={SIGNATURE_PATHS.main} stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ pathLength: drawMain, opacity: mainOpacity }} />
            <m.path ref={under} d={SIGNATURE_PATHS.under} stroke="currentColor" strokeWidth={3} strokeLinecap="round" style={{ pathLength: drawUnder, opacity: underOpacity }} />
          </svg>
          <m.span style={{ opacity: clear }} className="absolute top-2 right-2 z-10 flex h-11 items-center gap-1.5 rounded-xl bg-cinza/60 px-3.5 text-sm font-bold">
            <IconRotate size={16} strokeWidth={2.2} />
            Limpar
          </m.span>
          <Finger x={fx} y={fy} opacity={fingerOpacity} />
        </div>

        <p className="text-[13px] leading-[1.45] text-azul/80">Ao assinar, confirmo que devolvi o veículo com a quilometragem e o abastecimento informados.</p>
      </section>

      <footer className="mt-auto px-5 pt-4 pb-6">
        <MockButton icon={<IconCheck />} initial={false} enabled={[[c.draw[0], true]]} tapAt={c.tap} loadingAt={c.loading} loadingLabel="Enviando…">
          Confirmar e assinar
        </MockButton>
      </footer>
    </>
  );
}

function SummaryRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-2.5 text-[15px] ${last ? 'pb-3' : 'border-b border-cinza'}`}>
      <span className="shrink-0 text-azul/80">{label}</span>
      <span className="text-right font-bold tabular-nums">{value}</span>
    </div>
  );
}

/* ---------- Concluído ---------- */

/** Posição do check verde dentro do celular (para a transição em círculo partir dele). */
export const DONE_CHECK = { x: 207, y: 300 };

export function DoneMock() {
  const c = CHOREO.done;
  const circleScale = useTween(c.check, c.check + 0.65, [0.6, 1], ease.pop);
  const circleOpacity = useTween(c.check, c.check + 0.2, [0, 1]);
  const check = useTween(c.check + 0.25, c.check + 0.6, [0, 1], ease.expo);
  return (
    <>
      <StatusBar time="11:38" />
      <section className="flex flex-1 flex-col items-center justify-center gap-[18px] px-7 pb-6 text-center">
        <m.div style={{ scale: circleScale, opacity: circleOpacity }} className="flex size-[120px] items-center justify-center rounded-full bg-verde">
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none">
            <m.path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ pathLength: check }} />
          </svg>
        </m.div>
        <Reveal at={0.45} y={12} e={ease.expo}>
          <h1 className="mt-2.5 text-[28px] font-bold">Veículo devolvido</h1>
        </Reveal>
        <Reveal at={0.55} y={12} e={ease.expo}>
          <p className="max-w-[300px] text-base leading-normal text-azul/80">
            O {CAR.model} ({CAR.plate}) já está disponível para a próxima viagem.
          </p>
        </Reveal>
        <Reveal at={0.75} y={14} e={ease.expo} className="mt-2.5 flex w-full flex-col rounded-2xl bg-cinza/55 px-[18px] py-1 text-left">
          <DoneRow icon={<IconClock />}>
            Registro salvo às <strong>11:38</strong>
          </DoneRow>
          <DoneRow icon={<IconGauge />} divider>
            KM atualizado para <strong className="tabular-nums">{formatKm(DEMO.kmEnd)}</strong>
          </DoneRow>
          <DoneRow icon={<IconFuel />} divider>
            Gasolina R$ {money(DEMO.gas)} + Eletricidade R$ {money(DEMO.electric)}
          </DoneRow>
          <DoneRow icon={<IconPen />} divider>
            Assinatura anexada
          </DoneRow>
        </Reveal>
      </section>
      <footer className="px-5 pt-4 pb-6">
        <MockButton>Voltar ao início</MockButton>
      </footer>
    </>
  );
}

function DoneRow({ icon, divider = false, children }: { icon: ReactNode; divider?: boolean; children: ReactNode }) {
  return (
    <div className={`flex items-center gap-3 py-[13px] text-[15px] ${divider ? 'border-t border-cinza' : ''}`}>
      <span className="flex shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

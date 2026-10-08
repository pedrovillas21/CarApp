import { useLayoutEffect, useRef, type RefObject } from 'react';
import { m } from 'motion/react';
import { IconCheck, IconFuel, IconLogout, IconPen } from '../components/Icons';
import { LogoTexto } from '../components/Logo';
import { Cursor, type CursorStop } from './phone';
import { CHOREO, DEMO } from './roteiro';
import { SIGNATURE_PATHS } from './screens';
import { ease, seg, useCount, useFn, useIs, useKeys, useTween } from './timeline';

/**
 * Painel administrativo (projeto admCarApp, tela TripsScreen) reproduzido para o vídeo.
 * Mesmas seções e rótulos do painel real; números e nomes fictícios.
 */

export const PANEL_W = 1440;
export const PANEL_H = 880;

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const km = (v: number) => v.toLocaleString('pt-BR');

type Row = {
  out: [string, string];
  back: [string, string] | null;
  driver: string;
  plate: string;
  refuelTrip: boolean;
  destination: string | null;
  kmStart: number;
  kmEnd: number | null;
  duration: string | null;
  fuel: [string, number][];
};

const ROWS: Row[] = [
  { out: ['07/10/2026', '10:24'], back: ['07/10/2026', '11:38'], driver: DEMO.driver.name, plate: DEMO.car.plate, refuelTrip: true, destination: null, kmStart: 3405, kmEnd: 3487, duration: '1h 14min', fuel: [['Gasolina', 150], ['Eletricidade', 40]] },
  { out: ['07/10/2026', '08:52'], back: null, driver: DEMO.otherDriver.name, plate: DEMO.other.plate, refuelTrip: false, destination: 'Entrega de documentos', kmStart: 3128, kmEnd: null, duration: null, fuel: [] },
  { out: ['06/10/2026', '14:10'], back: ['06/10/2026', '16:02'], driver: 'João Mendes', plate: DEMO.car.plate, refuelTrip: false, destination: 'Visita técnica', kmStart: 3301, kmEnd: 3405, duration: '1h 52min', fuel: [] },
  { out: ['06/10/2026', '09:15'], back: ['06/10/2026', '10:20'], driver: 'Beatriz Alves', plate: DEMO.other.plate, refuelTrip: false, destination: 'Entrega de documentos', kmStart: 3071, kmEnd: 3128, duration: '1h 05min', fuel: [] },
  { out: ['03/10/2026', '13:40'], back: ['03/10/2026', '14:25'], driver: 'Rafael Costa', plate: DEMO.car.plate, refuelTrip: true, destination: 'Eletroposto', kmStart: 3288, kmEnd: 3301, duration: '45min', fuel: [['Eletricidade', 42]] },
  { out: ['02/10/2026', '08:30'], back: ['02/10/2026', '12:10'], driver: 'Luciana Prado', plate: DEMO.other.plate, refuelTrip: false, destination: 'Reunião externa', kmStart: 2952, kmEnd: 3071, duration: '3h 40min', fuel: [['Gasolina', 120]] },
];

/** Posição de um elemento dentro do painel (offsets não sofrem com transform de câmera). */
function offsetIn(el: HTMLElement | null, root: HTMLElement | null) {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x: x + (el?.offsetWidth ?? 0) / 2, y: y + (el?.offsetHeight ?? 0) / 2 };
}

export function AdminPanel() {
  const c = CHOREO.admin;
  const root = useRef<HTMLDivElement>(null);
  const ver = useRef<HTMLSpanElement>(null);
  const close = useRef<HTMLSpanElement>(null);
  const pdf = useRef<HTMLSpanElement>(null);
  const spots = useRef({ ver: { x: 0, y: 0 }, close: { x: 0, y: 0 }, pdf: { x: 0, y: 0 } });
  useLayoutEffect(() => {
    spots.current = { ver: offsetIn(ver.current, root.current), close: offsetIn(close.current, root.current), pdf: offsetIn(pdf.current, root.current) };
  });
  const stops = (): CursorStop[] => {
    const s = spots.current;
    return [
      { t: c.cursorIn, x: 980, y: 760 },
      { t: c.clickSignature - 0.25, x: s.ver.x, y: s.ver.y },
      { t: c.clickSignature, x: s.ver.x, y: s.ver.y, click: true },
      { t: c.clickClose - 0.3, x: s.close.x, y: s.close.y },
      { t: c.clickClose, x: s.close.x, y: s.close.y, click: true },
      { t: c.clickPdf - 0.3, x: s.pdf.x, y: s.pdf.y },
      { t: c.clickPdf, x: s.pdf.x, y: s.pdf.y, click: true },
      { t: c.clickPdf + 3, x: s.pdf.x + 40, y: s.pdf.y + 60 },
    ];
  };

  return (
    <div ref={root} className="relative overflow-hidden bg-[color-mix(in_srgb,var(--color-cinza)_40%,white)] text-azul" style={{ width: PANEL_W, height: PANEL_H }}>
      <header className="flex items-center gap-4 bg-azul px-8 py-4 text-white">
        <LogoTexto height={22} />
        <span className="h-6 w-px bg-white/25" />
        <span className="text-[15px] font-medium">Painel da Frota</span>
        <span className="ml-auto text-sm text-white/80">{DEMO.admin}</span>
        <span className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold">
          <IconLogout size={18} />
          Sair
        </span>
      </header>

      <main className="flex flex-col gap-5 px-8 py-7">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] leading-tight font-bold">Viagens</h1>
            <p className="text-[15px] text-azul/80">01/10/2026 a 31/10/2026</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex min-h-11 items-center gap-2.5 text-sm">
              <span className="flex size-[18px] items-center justify-center rounded-[4px] bg-azul text-white">
                <IconCheck size={13} strokeWidth={3} />
              </span>
              Assinaturas no PDF
            </span>
            <span className="inline-flex h-11 items-center gap-2 rounded-xl border-[1.5px] border-azul bg-white px-4 text-[15px] font-bold">
              <RefreshGlyph />
              Atualizar
            </span>
            <PdfButton spot={pdf} />
          </div>
        </div>

        <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_4px_18px_rgb(46_47_113/0.08)]">
          <div className="flex gap-2">
            {['Hoje', 'Este mês', 'Mês passado', 'Últimos 30 dias', 'Este ano'].map((label) => (
              <span key={label} className={`flex h-9 items-center rounded-full px-4 text-sm font-medium ${label === 'Este mês' ? 'bg-azul text-white' : 'bg-cinza/50'}`}>
                {label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-[145px_145px_repeat(4,minmax(0,1fr))_minmax(0,1.3fr)] gap-3">
            {[
              ['De', '01/10/2026'],
              ['Até', '31/10/2026'],
              ['Veículo', 'Todos'],
              ['Condutor', 'Todos'],
              ['Tipo', 'Todos'],
              ['Situação', 'Todas'],
              ['Buscar', ''],
            ].map(([label, value]) => (
              <span key={label} className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium">{label}</span>
                <span className="flex h-11 items-center rounded-xl border-[1.5px] border-cinza bg-white px-3 text-[15px]">
                  {value || <span className="text-azul/60">destino, condutor, placa</span>}
                </span>
              </span>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-5 gap-3">
          <Stat index={0} label="Viagens" value={useCount(48, c.stats[0], 1.2, (n) => String(Math.round(n)))} detail="9 de abastecimento" />
          <Stat index={1} label="KM rodados" value={useCount(3912, c.stats[0] + 0.1, 1.3, (n) => `${km(Math.round(n))} km`)} />
          <Stat index={2} label="Tempo em viagem" value={useCount(3680, c.stats[0] + 0.2, 1.3, (n) => `${Math.floor(n / 60)}h ${String(Math.round(n) % 60).padStart(2, '0')}min`)} />
          <Stat index={3} label="Em andamento" value={useCount(1, c.stats[0] + 0.3, 0.6, (n) => String(Math.round(n)))} highlight />
          <Stat
            index={4}
            label="Abastecimento"
            value={useCount(1640.5, c.stats[0] + 0.4, 1.3, (n) => brl(n))}
            detail={[`Gasolina ${brl(1210.5)}`, `Eletricidade ${brl(430)}`]}
          />
        </section>

        <section className="overflow-hidden rounded-2xl bg-white shadow-[0_4px_18px_rgb(46_47_113/0.08)]">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-azul text-[13px] text-white">
                {['Saída', 'Retorno', 'Condutor', 'Veículo', 'Tipo', 'Destino / motivo', 'KM inicial', 'KM final', 'KM rodados', 'Duração', 'Abastecimento', 'Assinatura'].map((h, i) => (
                  <th key={h} className={`px-3 py-3 font-bold whitespace-nowrap ${i >= 6 && i <= 10 ? 'text-right' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <TableRow key={i} row={row} index={i} at={c.rows + i * 0.09} verRef={i === 0 ? ver : undefined} />
              ))}
            </tbody>
          </table>
        </section>
      </main>

      <SignatureModal closeRef={close} />
      <PdfSheet />
      <Cursor stops={stops} show={[c.cursorIn, c.clickPdf + 3]} />
    </div>
  );
}

function RefreshGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-2.6-6.4L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

function PdfButton({ spot }: { spot: RefObject<HTMLSpanElement | null> }) {
  const c = CHOREO.admin;
  const busy = useIs((t) => t >= c.clickPdf + 0.05 && t < c.pdfOut + 0.2);
  const scale = useKeys([c.clickPdf - 0.02, c.clickPdf + 0.1, c.clickPdf + 0.45], [1, 0.95, 1], [ease.out, ease.pop]);
  const rotate = useFn((t) => (t * 420) % 360);
  return (
    <m.span ref={spot} style={{ scale }} className={`inline-flex h-11 items-center gap-2 rounded-xl px-4 text-[15px] font-bold ${busy ? 'bg-cinza text-azul/60' : 'bg-verde text-azul'}`}>
      {busy ? (
        <m.span className="size-4 rounded-full border-2 border-current border-r-transparent" style={{ rotate }} />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      )}
      {busy ? 'Preparando o relatório' : 'Baixar PDF'}
    </m.span>
  );
}

function Stat({ index, label, value, detail, highlight = false }: {
  index: number;
  label: string;
  value: ReturnType<typeof useCount>;
  detail?: string | string[];
  highlight?: boolean;
}) {
  const c = CHOREO.admin;
  // A barra verde da esquerda "preenche" de baixo para cima quando o número começa a contar.
  const bar = useTween(c.stats[0] + index * 0.1, c.stats[0] + index * 0.1 + 0.6, [0, 1], ease.expo);
  return (
    <div className="relative flex flex-col gap-1 overflow-hidden rounded-2xl bg-white py-3.5 pr-4 pl-5 shadow-[0_4px_18px_rgb(46_47_113/0.08)]">
      <m.span className="absolute inset-y-0 left-0 w-1 origin-bottom bg-verde" style={{ scaleY: bar }} />
      <span className="text-xs font-medium tracking-[0.5px] text-azul/80 uppercase">{label}</span>
      <span className="flex items-center text-2xl font-bold tabular-nums">
        <m.span>{value}</m.span>
        {highlight && <span className="ml-2 inline-block size-2.5 rounded-full bg-verde" />}
      </span>
      {detail && (
        <span className="flex flex-col text-xs text-azul/80">
          {(Array.isArray(detail) ? detail : [detail]).map((line) => (
            <span key={line}>{line}</span>
          ))}
        </span>
      )}
    </div>
  );
}

function TableRow({ row, index, at, verRef }: { row: Row; index: number; at: number; verRef?: RefObject<HTMLSpanElement | null> }) {
  const opacity = useTween(at, at + 0.35, [0, 1]);
  const y = useTween(at, at + 0.5, [14, 0], ease.expo);
  const td = 'px-3 py-3 align-middle';
  const num = `${td} text-right whitespace-nowrap tabular-nums`;
  return (
    <m.tr style={{ opacity, y }} className={`border-b border-cinza/70 ${index % 2 ? 'bg-cinza/20' : ''}`}>
      <td className={td}>
        <DateCell value={row.out} />
      </td>
      <td className={td}>
        {row.back ? (
          <DateCell value={row.back} />
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-verde/20 px-2.5 py-1 text-xs font-bold whitespace-nowrap">
            <span className="size-2 rounded-full bg-verde" />
            Em andamento
          </span>
        )}
      </td>
      <td className={`${td} font-medium`}>{row.driver}</td>
      <td className={td}>
        <span className="flex flex-col items-start gap-1">
          <span>BYD King</span>
          <span className="inline-flex flex-col overflow-hidden rounded-md border-[1.5px] border-azul bg-white">
            <span className="h-[4px] bg-azul" />
            <span className="px-[6px] pt-px pb-[2px] text-[11px] font-bold tracking-[0.8px]">{row.plate}</span>
          </span>
        </span>
      </td>
      <td className={td}>
        {row.refuelTrip ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-laranja/25 px-2.5 py-1 text-xs font-bold whitespace-nowrap">
            <IconFuel size={14} />
            Abastecimento
          </span>
        ) : (
          <span className="whitespace-nowrap">Viagem normal</span>
        )}
      </td>
      <td className={`${td} max-w-[200px]`}>{row.destination ?? <span className="text-azul/60">—</span>}</td>
      <td className={num}>{km(row.kmStart)}</td>
      <td className={num}>{row.kmEnd === null ? '—' : km(row.kmEnd)}</td>
      <td className={`${num} font-bold`}>{row.kmEnd === null ? '—' : km(row.kmEnd - row.kmStart)}</td>
      <td className={num}>{row.duration ?? '—'}</td>
      <td className={num}>
        {row.fuel.length === 0 ? (
          <span className="text-azul/60">—</span>
        ) : (
          <span className="flex flex-col items-end leading-tight">
            {row.fuel.map(([label, value]) => (
              <span key={label}>
                <span className="text-[13px] text-azul/80">{label}</span> {brl(value)}
              </span>
            ))}
            {row.fuel.length > 1 && <span className="font-bold">Total {brl(row.fuel.reduce((s, [, v]) => s + v, 0))}</span>}
          </span>
        )}
      </td>
      <td className={td}>
        {row.back ? (
          <span ref={verRef} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-bold">
            <IconPen size={15} />
            Ver
          </span>
        ) : (
          <span className="text-azul/60">—</span>
        )}
      </td>
    </m.tr>
  );
}

function DateCell({ value }: { value: [string, string] }) {
  return (
    <span className="flex flex-col leading-tight whitespace-nowrap">
      <span>{value[0]}</span>
      <span className="text-[13px] text-azul/80">{value[1]}</span>
    </span>
  );
}

/** Janela "Assinatura de …" do painel, com a mesma assinatura feita no celular. */
function SignatureModal({ closeRef }: { closeRef: RefObject<HTMLSpanElement | null> }) {
  const c = CHOREO.admin;
  const open = c.clickSignature + 0.1;
  const shut = c.clickClose + 0.05;
  const backdrop = useKeys([open, open + 0.3, shut, shut + 0.25], [0, 1, 1, 0], [ease.out, ease.linear, ease.in]);
  const scale = useKeys([open, open + 0.45, shut, shut + 0.25], [0.94, 1, 1, 0.96], [ease.expo, ease.linear, ease.in]);
  const draw = useFn((t) => seg(t, open + 0.25, open + 1.1, ease.inOut));
  const under = useFn((t) => seg(t, open + 1.1, open + 1.35, ease.out));
  const drawOn = useFn((t) => (t > open + 0.25 ? 1 : 0));
  const underOn = useFn((t) => (t > open + 1.1 ? 1 : 0));
  const visible = useIs((t) => t >= open - 0.05 && t <= shut + 0.3);
  return (
    <m.div className="absolute inset-0 z-40 flex items-center justify-center bg-azul/50" style={{ opacity: backdrop, visibility: visible ? 'visible' : 'hidden' }}>
      <m.div style={{ scale }} className="flex w-[560px] flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_14px_36px_rgb(46_47_113/0.25)]">
        <div className="flex items-start gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <h2 className="text-lg font-bold">Assinatura de {DEMO.driver.name}</h2>
            <p className="flex flex-wrap items-center gap-2 text-sm text-azul/80">
              BYD King
              <span className="inline-flex flex-col overflow-hidden rounded-md border-[1.5px] border-azul bg-white">
                <span className="h-[4px] bg-azul" />
                <span className="px-[6px] pt-px pb-[2px] text-[11px] font-bold tracking-[0.8px] text-azul">{DEMO.car.plate}</span>
              </span>
              · retorno 07/10/2026 11:38
            </p>
          </div>
          <span ref={closeRef} className="flex size-10 items-center justify-center rounded-xl">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </span>
        </div>
        <div className="flex min-h-[200px] items-center justify-center rounded-xl border-[1.5px] border-cinza bg-white p-2">
          <svg width={SIGNATURE_PATHS.w} height={SIGNATURE_PATHS.h} viewBox={`0 0 ${SIGNATURE_PATHS.w} ${SIGNATURE_PATHS.h}`} fill="none">
            <m.path d={SIGNATURE_PATHS.main} stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ pathLength: draw, opacity: drawOn }} />
            <m.path d={SIGNATURE_PATHS.under} stroke="currentColor" strokeWidth={3} strokeLinecap="round" style={{ pathLength: under, opacity: underOn }} />
          </svg>
        </div>
      </m.div>
    </m.div>
  );
}

/** Folha A4 deitada do relatório, saindo do botão "Baixar PDF". */
function PdfSheet() {
  const c = CHOREO.admin;
  const at = c.pdfOut;
  const opacity = useTween(at, at + 0.2, [0, 1]);
  const x = useTween(at, at + 0.9, [560, 0], ease.expo);
  const y = useTween(at, at + 0.9, [-330, 0], ease.expo);
  const scale = useTween(at, at + 0.9, [0.2, 1], ease.expo);
  const rotate = useTween(at, at + 1.1, [10, -2.5], ease.soft);
  const drift = useFn((t) => (t > at + 1 ? Math.sin((t - at) * 1.3) * 3 : 0));
  return (
    <m.div className="absolute top-[200px] left-[420px] z-40 w-[720px]" style={{ opacity, x, y, scale, rotate, translateY: drift }}>
      <div className="flex aspect-[297/210] flex-col gap-3 rounded-md bg-white p-6 shadow-[0_30px_60px_rgb(46_47_113/0.35)]">
        <div className="flex items-center justify-between rounded bg-azul px-4 py-3 text-white">
          <LogoTexto height={18} />
          <span className="flex flex-col items-end text-right">
            <span className="text-[15px] font-bold">Relatório de viagens</span>
            <span className="text-[11px] text-white/80">Período: 01/10/2026 a 31/10/2026</span>
          </span>
        </div>
        <span className="text-[11px] text-azul/80">Filtros: nenhum (todas as viagens do período)</span>
        <div className="grid grid-cols-5 gap-2">
          {[
            ['Viagens', '48'],
            ['KM rodados', '3.912 km'],
            ['Tempo', '61h 20min'],
            ['Em andamento', '1'],
            ['Abastecimento', brl(1640.5)],
          ].map(([label, value]) => (
            <span key={label} className="flex flex-col rounded border-l-[3px] border-verde bg-cinza/30 px-2 py-1.5">
              <span className="text-[8px] font-bold tracking-[0.4px] uppercase">{label}</span>
              <span className="text-[13px] font-bold">{value}</span>
            </span>
          ))}
        </div>
        <div className="flex flex-col overflow-hidden rounded border border-cinza">
          <span className="h-5 bg-azul" />
          {ROWS.slice(0, 5).map((row, i) => (
            <span key={i} className={`flex h-7 items-center gap-3 px-2 text-[9px] ${i % 2 ? 'bg-cinza/25' : ''}`}>
              <span className="w-16">{row.out[0]}</span>
              <span className="w-24 font-bold">{row.driver}</span>
              <span className="w-14">{row.plate}</span>
              <span className="flex-1 text-azul/70">{row.destination ?? '—'}</span>
              <span className="w-12 text-right">{row.kmEnd === null ? '—' : km(row.kmEnd - row.kmStart)} km</span>
              <svg width="54" height="16" viewBox={`0 0 ${SIGNATURE_PATHS.w} ${SIGNATURE_PATHS.h}`} preserveAspectRatio="xMidYMid meet" fill="none">
                {row.back && <path d={SIGNATURE_PATHS.main} stroke="#2e2f71" strokeWidth={10} strokeLinecap="round" />}
              </svg>
            </span>
          ))}
        </div>
        <div className="mt-auto flex items-end justify-between text-[10px] text-azul/80">
          <span>Resumo por veículo e por condutor na página seguinte</span>
          <span className="flex flex-col items-center gap-1">
            <span className="h-px w-44 bg-azul/50" />
            Conferido por / Data
          </span>
        </div>
      </div>
    </m.div>
  );
}

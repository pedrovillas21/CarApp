/**
 * Roteiro: fonte única de tempos do vídeo.
 * Cenas, coreografia das telas, legendas, narração, efeitos sonoros e capítulos saem daqui,
 * então animação e áudio (gerado fora do navegador) nunca se desencontram.
 * Tempos em segundos. "rel" = relativo ao início da tela/cena.
 */

export type Format = '16x9' | '9x16' | '1x1';
export type Beat = { from: number; to: number };
export type Cue = { at: number; limit: number; text: string };
export type Sfx = { at: number; kind: SfxKind };
export type SfxKind = 'tap' | 'key' | 'pop' | 'tick' | 'whoosh' | 'hit' | 'alert' | 'pen' | 'click' | 'paper' | 'chime';

/* ---------- dados fictícios (nada real: placas, nomes e e-mails inventados) ---------- */

export const DEMO = {
  car: { model: 'BYD King', plate: 'QOF7H23', km: 3405, image: '/vehicles/byd-king.webp' },
  other: { model: 'BYD King', plate: 'RJT4B81', km: 3128 },
  driver: { name: 'Carlos Lima', first: 'Carlos', initials: 'CL', email: 'carlos.lima@exemplo.org' },
  otherDriver: { name: 'Ana Paula Rocha', short: 'Ana Paula', initials: 'AR' },
  admin: 'Fernanda Souza',
  kmEnd: 3487,
  gas: 150,
  electric: 40,
  contact: 'informatica@crefito11.gov.br',
};

/* ---------- coreografia de cada tela do celular (rel) ---------- */

export const CHOREO = {
  login: { dur: 5, pwd: [2.0, 2.9] as const, tap: 3.6, loading: 3.75 },
  home: { dur: 5, glow: [1.3, 3.7] as const, tap: 4.4 },
  start: { dur: 7, plate: 0.45, carGlow: [0.4, 1.5] as const, tapFuel: 1.8, scroll: [2.5, 3.2] as const, kmGlow: [3.2, 4.6] as const, tap: 5.6, loading: 5.75 },
  trip: { dur: 6, ff: [1.0, 3.0] as const, tap: 5.2 },
  km: {
    dur: 7,
    keys: [
      [0.9, '3'],
      [1.15, '4'],
      [1.4, '8'],
      [1.65, '7'],
      [3.2, '0'],
      [4.6, 'back'],
    ] as [number, string][],
    tap: 5.9,
  },
  fuel: {
    dur: 7,
    tapBoth: 1.0,
    gasTap: 1.45,
    gas: [
      [1.6, '1'],
      [1.8, '5'],
      [2.0, '0'],
      [2.2, '0'],
      [2.4, '0'],
    ] as [number, string][],
    eleTap: 2.7,
    ele: [
      [2.9, '4'],
      [3.1, '0'],
      [3.3, '0'],
      [3.5, '0'],
    ] as [number, string][],
    total: 3.6,
    tap: 6.0,
  },
  sign: { dur: 6, draw: [1.0, 2.4] as const, under: [2.5, 2.85] as const, tap: 4.6, loading: 4.75 },
  done: { dur: 4.2, check: 0.2 },
  // Painel administrativo (rel ao início da cena "Gestão").
  admin: {
    frameIn: 0.2,
    stats: [1.2, 2.6] as const,
    rows: 1.6,
    cursorIn: 4.4,
    clickSignature: 5.8,
    clickClose: 7.9,
    clickPdf: 9.2,
    pdfOut: 9.8,
  },
};

/* ---------- versão principal 16:9 ---------- */

export const MAIN = {
  duration: 89.5,
  hook: { from: 0, to: 5.6 },
  hookCuts: [0, 1.7, 3.4],
  brand: { from: 5.2, to: 10 },
  screens: {
    login: { from: 8.0, to: 13 },
    home: { from: 13, to: 18 },
    start: { from: 18, to: 25 },
    trip: { from: 25, to: 31 },
    km: { from: 31, to: 38 },
    fuel: { from: 38, to: 45 },
    sign: { from: 45, to: 51 },
    done: { from: 51, to: 55.6 },
  },
  panorama: { from: 55.2, to: 68.4 },
  proof: { from: 68, to: 78.4 },
  close: { from: 78, to: 89.5 },
};

/** Legenda de benefício por tela (no máximo 7 palavras). */
export const CAPTIONS: Record<keyof typeof MAIN.screens, { eyebrow: string; text: string; at: number }> = {
  login: { eyebrow: 'Entrada', text: 'Seu e-mail já vem preenchido', at: 2.0 },
  home: { eyebrow: 'Frota', text: 'Veja quem está com cada carro', at: 0.3 },
  start: { eyebrow: 'Saída', text: 'KM inicial sem digitar nada', at: 0.3 },
  trip: { eyebrow: 'Em viagem', text: 'O tempo conta sozinho', at: 0.3 },
  km: { eyebrow: 'Retorno', text: 'KM conferido na hora', at: 0.3 },
  fuel: { eyebrow: 'Abastecimento', text: 'Valor e comprovante, tudo registrado', at: 0.3 },
  sign: { eyebrow: 'Assinatura', text: 'Assinou, está comprovado', at: 0.3 },
  done: { eyebrow: 'Pronto', text: 'Carro liberado para o próximo', at: 0.3 },
};

export const PROOF = [
  { at: 0.4, title: 'Agilidade', text: 'Saída registrada em segundos' },
  { at: 2.6, title: 'Segurança', text: 'Só entra quem é cadastrado' },
  { at: 5.2, title: 'Transparência', text: 'Quem usou, quando e quanto' },
  { at: 7.8, title: 'Controle', text: 'Abastecimento com valor e comprovante' },
];

export const CHAPTERS = [
  { at: 0, label: 'Problema' },
  { at: 5.2, label: 'Controle de Frota' },
  { at: 10, label: 'Entrada' },
  { at: 13, label: 'Frota' },
  { at: 18, label: 'Saída' },
  { at: 25, label: 'Em viagem' },
  { at: 31, label: 'KM final' },
  { at: 38, label: 'Abastecimento' },
  { at: 45, label: 'Assinatura' },
  { at: 51, label: 'Pronto' },
  { at: 55.2, label: 'Gestão' },
  { at: 68, label: 'Benefícios' },
  { at: 78, label: 'Contato' },
];

/** Narração (voz pt-BR-AntonioNeural). `limit` = até quando a fala pode ir. */
export const NARRATION: Cue[] = [
  { at: 0.25, limit: 1.65, text: 'Quem está com o carro agora?' },
  { at: 1.85, limit: 3.35, text: 'O KM anotado confere?' },
  { at: 3.5, limit: 5.3, text: 'E o abastecimento, quem registrou?' },
  { at: 5.7, limit: 9.9, text: 'Com o Controle de Frota do Crefito 11, cada viagem é registrada em segundos.' },
  { at: 10.15, limit: 12.9, text: 'O condutor entra com o e-mail já lembrado.' },
  { at: 13.2, limit: 15.7, text: 'E vê na hora quem está com cada carro.' },
  { at: 15.9, limit: 17.9, text: 'Livre ou em uso, com foto e placa.' },
  { at: 18.3, limit: 21.2, text: 'Para sair, escolhe o carro e o tipo de viagem.' },
  { at: 21.4, limit: 24.9, text: 'O KM inicial já vem preenchido, sem digitar nada.' },
  { at: 25.3, limit: 28.4, text: 'O cronômetro conta sozinho, mesmo com o app fechado.' },
  { at: 28.6, limit: 30.9, text: 'Na volta, é só finalizar.' },
  { at: 31.2, limit: 35.6, text: 'O KM final é conferido na hora: um dígito a mais, e o app avisa.' },
  { at: 38.3, limit: 41.5, text: 'O abastecimento entra com o valor do comprovante.' },
  { at: 41.7, limit: 44.8, text: 'Gasolina, recarga elétrica, ou os dois.' },
  { at: 45.2, limit: 49.3, text: 'Para fechar, o condutor confere o resumo e assina com o dedo.' },
  { at: 51.3, limit: 54.6, text: 'Pronto. O carro volta a ficar disponível.' },
  { at: 55.6, limit: 58.1, text: 'E a gestão vê tudo em um só lugar.' },
  { at: 58.3, limit: 63.9, text: 'Viagens, quilômetros, tempo e gasto com abastecimento, com filtros por período, carro e condutor.' },
  { at: 64.1, limit: 67.8, text: 'As assinaturas ficam anexadas, e o relatório sai em PDF.' },
  { at: 68.4, limit: 70.5, text: 'Mais agilidade para quem dirige.' },
  { at: 70.6, limit: 73.1, text: 'Segurança: só entra quem é cadastrado.' },
  { at: 73.2, limit: 75.7, text: 'Transparência sobre quem usou, quando e quanto.' },
  { at: 75.8, limit: 77.9, text: 'E controle real do abastecimento.' },
  { at: 78.4, limit: 82.2, text: 'Controle de Frota. Cada viagem, registrada em segundos.' },
  { at: 82.4, limit: 88.6, text: 'Peça seu acesso: informática, arroba, crefito onze, ponto gov, ponto br.' },
];

/** Texto das legendas queimadas (versão muda): igual à narração, com o e-mail escrito. */
export const SUBTITLES: Cue[] = NARRATION.map((cue) =>
  cue.text.startsWith('Peça seu acesso') ? { ...cue, text: `Peça seu acesso: ${DEMO.contact}` } : cue,
);

/* ---------- versão curta 9:16 ---------- */

export const SHORT = {
  duration: 28,
  hook: { from: 0, to: 3.0 },
  brand: { from: 2.6, to: 5.6 },
  screens: {
    home: { from: 5.2, to: 10.2 },
    km: { from: 10.2, to: 17.2 },
    sign: { from: 17.2, to: 23.2 },
  },
  close: { from: 22.8, to: 28 },
};

export const SHORT_CAPTIONS: Record<keyof typeof SHORT.screens, string> = {
  home: 'Veja quem está com cada carro',
  km: 'KM conferido na hora',
  sign: 'Assinou, está comprovado',
};

/* ---------- teaser 1:1 (loop) ---------- */

export const TEASER = {
  duration: 10,
  hook: { from: 0, to: 2.9 },
  phone: { from: 2.5, to: 7.6 },
  close: { from: 7.2, to: 10 },
};

/* ---------- efeitos sonoros ---------- */

function tapsOf(screens: Record<string, Beat>, include: (keyof typeof CHOREO)[]) {
  const out: Sfx[] = [];
  const at = (beat: Beat, rel: number, kind: SfxKind) => out.push({ at: beat.from + rel, kind });
  for (const name of include) {
    const beat = screens[name];
    if (!beat) continue;
    if (name === 'login') {
      const c = CHOREO.login;
      for (let i = 0; i < 6; i++) at(beat, c.pwd[0] + (i * (c.pwd[1] - c.pwd[0])) / 5, 'key');
      at(beat, c.tap, 'tap');
    }
    if (name === 'home') at(beat, CHOREO.home.tap, 'tap');
    if (name === 'start') {
      at(beat, CHOREO.start.plate, 'pop');
      at(beat, CHOREO.start.tapFuel, 'tap');
      at(beat, CHOREO.start.tap, 'tap');
    }
    if (name === 'trip') {
      const [a, b] = CHOREO.trip.ff;
      for (let t = 0.2; t < a; t += 1) at(beat, t, 'tick');
      for (let t = b; t < CHOREO.trip.dur - 0.2; t += 1) at(beat, t, 'tick');
      at(beat, CHOREO.trip.tap, 'tap');
    }
    if (name === 'km') {
      for (const [t] of CHOREO.km.keys) at(beat, t, 'key');
      at(beat, CHOREO.km.keys[3][0] + 0.05, 'pop');
      at(beat, CHOREO.km.keys[4][0] + 0.05, 'alert');
      at(beat, CHOREO.km.tap, 'tap');
    }
    if (name === 'fuel') {
      const c = CHOREO.fuel;
      at(beat, c.tapBoth, 'tap');
      at(beat, c.gasTap, 'tap');
      at(beat, c.eleTap, 'tap');
      for (const [t] of [...c.gas, ...c.ele]) at(beat, t, 'key');
      at(beat, c.total, 'pop');
      at(beat, c.tap, 'tap');
    }
    if (name === 'sign') {
      at(beat, CHOREO.sign.draw[0], 'pen');
      at(beat, CHOREO.sign.tap, 'tap');
    }
    if (name === 'done') at(beat, CHOREO.done.check + 0.2, 'chime');
  }
  return out;
}

function mainSfx(): Sfx[] {
  const s: Sfx[] = [];
  for (const cut of MAIN.hookCuts) s.push({ at: cut, kind: 'hit' });
  s.push({ at: MAIN.brand.from, kind: 'whoosh' });
  s.push(...tapsOf(MAIN.screens, ['login', 'home', 'start', 'trip', 'km', 'fuel', 'sign', 'done']));
  s.push({ at: MAIN.panorama.from - 0.2, kind: 'whoosh' });
  const a = CHOREO.admin;
  const p = MAIN.panorama.from;
  s.push({ at: p + a.clickSignature, kind: 'click' }, { at: p + a.clickClose, kind: 'click' }, { at: p + a.clickPdf, kind: 'click' });
  s.push({ at: p + a.pdfOut, kind: 'paper' });
  s.push({ at: MAIN.proof.from - 0.2, kind: 'whoosh' });
  for (const item of PROOF) s.push({ at: MAIN.proof.from + item.at + 0.15, kind: 'pop' });
  s.push({ at: MAIN.close.from - 0.2, kind: 'whoosh' });
  s.push({ at: MAIN.close.from + 0.6, kind: 'chime' });
  return s.sort((x, y) => x.at - y.at);
}

function shortSfx(): Sfx[] {
  return ([

    { at: 0, kind: 'hit' },
    { at: SHORT.brand.from, kind: 'whoosh' },
    ...tapsOf(SHORT.screens, ['home', 'km', 'sign']),
    { at: SHORT.close.from - 0.2, kind: 'whoosh' },
    { at: SHORT.close.from + 0.5, kind: 'chime' },
  ] as Sfx[]).sort((x, y) => x.at - y.at);
}

export const AUDIO: Record<Format, { duration: number; narration: Cue[]; sfx: Sfx[] }> = {
  '16x9': { duration: MAIN.duration, narration: NARRATION, sfx: mainSfx() },
  '9x16': { duration: SHORT.duration, narration: [], sfx: shortSfx() },
  '1x1': { duration: TEASER.duration, narration: [], sfx: [{ at: 0, kind: 'hit' }, { at: TEASER.close.from, kind: 'whoosh' }] },
};

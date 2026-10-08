/**
 * Escolhe, entre os pontos gravados na viagem, quais vão para o cálculo da rota.
 * Sem dependências de Deno ou Supabase: dá para testar com o Node.
 */
export type TipoPonto = 'saida' | 'parada' | 'percurso' | 'retorno';

export type PontoViagem = {
  kind: TipoPonto;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  recorded_at: string;
};

export type Coordenada = { lat: number; lng: number };

export type Classificacao =
  | { status: 'sem_gps' }
  | { status: 'incompleta' }
  | { status: 'calcular'; pontos: Coordenada[] };

/** Ponto com precisão pior que isso não ajuda a achar a rua (o raio de ajuste é 500 m). */
const PRECISAO_MAXIMA_M = 500;

/** Todos os pontos dentro deste raio da saída: não há como saber por onde o carro andou. */
const RAIO_INCOMPLETA_M = 300;

/** Pontos de percurso quase no mesmo lugar do anterior só gastam vaga no limite do serviço. */
const DISTANCIA_MINIMA_M = 25;

export function distanciaM(a: Coordenada, b: Coordenada) {
  const rad = (graus: number) => (graus * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Escolhe `quantos` itens espalhados de forma uniforme, mantendo a ordem. */
export function amostrar<T>(itens: T[], quantos: number): T[] {
  if (quantos <= 0) return [];
  if (itens.length <= quantos) return itens;
  if (quantos === 1) return [itens[Math.floor(itens.length / 2)]];
  const passo = (itens.length - 1) / (quantos - 1);
  return Array.from({ length: quantos }, (_, i) => itens[Math.round(i * passo)]);
}

/**
 * - nenhum ponto: sem_gps;
 * - todos os pontos a menos de 300 m da saída (ex.: só saída e retorno na sede): incompleta,
 *   porque a rota daria ~0 km e geraria um aviso injusto;
 * - senão: até `maxPontos` pontos em ordem de horário. Saída, paradas e retorno ficam sempre;
 *   os de percurso são reduzidos de forma uniforme para caber no limite.
 */
export function classificar(gravados: PontoViagem[], maxPontos: number): Classificacao {
  if (gravados.length === 0) return { status: 'sem_gps' };

  const ordenados = gravados
    .filter((p) => p.accuracy_m === null || p.accuracy_m <= PRECISAO_MAXIMA_M)
    .sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at));
  if (ordenados.length === 0) return { status: 'incompleta' };

  const origem = ordenados[0];
  if (ordenados.every((p) => distanciaM(origem, p) < RAIO_INCOMPLETA_M)) return { status: 'incompleta' };

  // Tira percursos colados no ponto anterior.
  const limpos: PontoViagem[] = [];
  for (const p of ordenados) {
    const anterior = limpos.at(-1);
    if (p.kind === 'percurso' && anterior && distanciaM(anterior, p) < DISTANCIA_MINIMA_M) continue;
    limpos.push(p);
  }

  const fixos = limpos.filter((p) => p.kind !== 'percurso');
  const percurso = limpos.filter((p) => p.kind === 'percurso');

  let escolhidos: PontoViagem[];
  if (fixos.length >= maxPontos) {
    // Caso raro (dezenas de paradas): reduz as paradas também, mantendo o primeiro e o último ponto.
    escolhidos = [limpos[0], ...amostrar(fixos.slice(1, -1), maxPontos - 2), limpos.at(-1)!];
  } else {
    const vagas = Math.min(percurso.length, maxPontos - fixos.length);
    const mantidos = new Set([...fixos, ...amostrar(percurso, vagas)]);
    escolhidos = limpos.filter((p) => mantidos.has(p));
  }

  return { status: 'calcular', pontos: escolhidos.map((p) => ({ lat: p.lat, lng: p.lng })) };
}

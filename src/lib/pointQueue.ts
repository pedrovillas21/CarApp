/**
 * Fila de pontos de GPS no aparelho, uma por viagem. Sobrevive a falta de sinal e a fechar o app:
 * o ponto entra na fila na hora e é enviado quando der. Cada ponto tem id próprio,
 * então reenviar um lote que já tinha chegado não duplica nada no banco.
 */
import { addTripPoints, toAppError, type ErrorCode, type PointKind, type TripPoint } from './api';
import { getPosition, type GeoFix, type GeoResult } from './location';

const PREFIX = 'frota:pontos:';

/** Pontos por chamada. Igual ao limite em add_trip_points (V6__rota_das_viagens.sql). */
const BATCH_SIZE = 500;

// Reenviar não adianta: o lote (ou a fila toda) é descartado para não travar o envio do resto.
const DROP_BATCH = new Set<ErrorCode>(['POINT_INVALID', 'TOO_MANY_POINTS']);
const DROP_QUEUE = new Set<ErrorCode>(['TRIP_NOT_FOUND', 'TRIP_ALREADY_FINISHED', 'NOT_A_DRIVER']);

function read(tripId: string): TripPoint[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PREFIX + tripId) ?? '[]');
    return Array.isArray(parsed) ? (parsed as TripPoint[]) : [];
  } catch {
    return [];
  }
}

function write(tripId: string, points: TripPoint[]) {
  try {
    if (points.length) localStorage.setItem(PREFIX + tripId, JSON.stringify(points));
    else localStorage.removeItem(PREFIX + tripId);
  } catch {
    // armazenamento bloqueado ou cheio: o ponto se perde, a viagem segue
  }
}

export function enqueuePoint(tripId: string, kind: PointKind, fix: GeoFix) {
  write(tripId, [...read(tripId), { id: crypto.randomUUID(), kind, ...fix }]);
}

/** Lê o GPS e, se conseguir, põe o ponto na fila. Não envia: chame flushPoints depois. */
export async function recordPoint(tripId: string, kind: PointKind): Promise<GeoResult> {
  const result = await getPosition();
  if (!('error' in result)) enqueuePoint(tripId, kind, result);
  return result;
}

async function send(tripId: string) {
  // Limite de voltas: 5.000 pontos por viagem cabem em 10 lotes.
  for (let round = 0; round < 20; round++) {
    const batch = read(tripId).slice(0, BATCH_SIZE);
    if (!batch.length) return;
    try {
      await addTripPoints(tripId, batch);
    } catch (err) {
      const code = toAppError(err).code;
      if (DROP_QUEUE.has(code)) {
        write(tripId, []);
        return;
      }
      if (!DROP_BATCH.has(code)) return; // sem conexão ou erro passageiro: fica para a próxima
    }
    const sent = new Set(batch.map((p) => p.id));
    write(tripId, read(tripId).filter((p) => !sent.has(p.id)));
  }
}

const running = new Map<string, Promise<void>>();

/** Envia a fila da viagem. Nunca falha: o que não foi aceito continua na fila. Chamadas seguidas entram em fila. */
export function flushPoints(tripId: string): Promise<void> {
  const previous = running.get(tripId) ?? Promise.resolve();
  const next = previous.then(() => send(tripId)).catch(() => {});
  running.set(tripId, next);
  void next.then(() => {
    if (running.get(tripId) === next) running.delete(tripId);
  });
  return next;
}

export function clearPoints(tripId: string) {
  write(tripId, []);
}

/** Apaga filas de viagens que já não estão abertas: o banco recusaria esses pontos. */
export function pruneQueues(openTripId: string | null) {
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX) && key !== PREFIX + openTripId) stale.push(key);
    }
    for (const key of stale) localStorage.removeItem(key);
  } catch {
    // armazenamento bloqueado: não há fila
  }
}

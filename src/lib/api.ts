import { supabase } from './supabase';

export type FleetVehicle = {
  id: string;
  plate: string;
  model: string;
  currentKm: number;
  imageUrl: string | null;
  inUse: boolean;
  driverName: string | null;
  tripStartedAt: string | null;
  isMine: boolean;
};

export type OpenTrip = {
  id: string;
  vehicleId: string;
  plate: string;
  model: string;
  imageUrl: string | null;
  destination: string | null;
  kmStart: number;
  startedAt: string;
};

export type FinishedTrip = {
  plate: string;
  model: string;
  kmEnd: number;
  endedAt: string;
};

export type Conflict = { driver: string | null; startedAt: string | null };

const MESSAGES = {
  NOT_A_DRIVER: 'Seu usuário não tem acesso ao controle de frota. Fale com a administração.',
  VEHICLE_NOT_FOUND: 'Este carro não está mais disponível na frota.',
  VEHICLE_IN_USE: 'Este carro acabou de sair com outro condutor.',
  DRIVER_HAS_OPEN_TRIP: 'Você já tem uma viagem em andamento.',
  TRIP_NOT_FOUND: 'Viagem não encontrada.',
  TRIP_ALREADY_FINISHED: 'Esta viagem já foi finalizada.',
  KM_END_INVALID: 'O KM final não pode ser menor que o inicial.',
  KM_END_TOO_HIGH: 'O KM final está muito acima do inicial. Confira o hodômetro.',
  SIGNATURE_INVALID: 'Assinatura inválida. Assine de novo.',
  SIGNATURE_MISSING: 'A assinatura não foi enviada. Tente de novo.',
  OFFLINE: 'Sem conexão com a internet. Tente de novo quando a conexão voltar.',
  UNKNOWN: 'Algo deu errado. Tente de novo.',
} as const;

export type ErrorCode = keyof typeof MESSAGES;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly detail: string | null;

  constructor(code: ErrorCode, detail: string | null = null) {
    super(MESSAGES[code]);
    this.code = code;
    this.detail = detail;
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const e = (error ?? {}) as { message?: string; details?: string | null };
  const message = e.message ?? '';
  if (message in MESSAGES) return new AppError(message as ErrorCode, e.details ?? null);
  if (!navigator.onLine || /fetch|network|load failed/i.test(message)) return new AppError('OFFLINE');
  return new AppError('UNKNOWN');
}

export function parseConflict(error: AppError): Conflict {
  try {
    const parsed = JSON.parse(error.detail ?? '{}') as { driver?: string; started_at?: string };
    return { driver: parsed.driver ?? null, startedAt: parsed.started_at ?? null };
  } catch {
    return { driver: null, startedAt: null };
  }
}

type FleetRow = {
  id: string;
  plate: string;
  model: string;
  current_km: number;
  image_url: string | null;
  in_use: boolean;
  driver_name: string | null;
  trip_started_at: string | null;
  is_mine: boolean;
};

type OpenTripRow = {
  id: string;
  vehicle_id: string;
  plate: string;
  model: string;
  image_url: string | null;
  destination: string | null;
  km_start: number;
  started_at: string;
};

type TripRow = {
  id: string;
  vehicle_id: string;
  destination: string | null;
  km_start: number;
  km_end: number | null;
  started_at: string;
  ended_at: string | null;
};

export async function fetchFleet(): Promise<FleetVehicle[]> {
  const { data, error } = await supabase.rpc('get_fleet');
  if (error) throw toAppError(error);
  return ((data ?? []) as FleetRow[]).map((r) => ({
    id: r.id,
    plate: r.plate,
    model: r.model,
    currentKm: r.current_km,
    imageUrl: r.image_url ?? null,
    inUse: r.in_use,
    driverName: r.driver_name,
    tripStartedAt: r.trip_started_at,
    isMine: r.is_mine,
  }));
}

export async function fetchOpenTrip(): Promise<OpenTrip | null> {
  const { data, error } = await supabase.rpc('get_my_open_trip');
  if (error) throw toAppError(error);
  const row = ((data ?? []) as OpenTripRow[])[0];
  if (!row) return null;
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    plate: row.plate,
    model: row.model,
    imageUrl: row.image_url ?? null,
    destination: row.destination,
    kmStart: row.km_start,
    startedAt: row.started_at,
  };
}

export async function startTrip(vehicle: FleetVehicle, destination: string): Promise<OpenTrip> {
  const { data, error } = await supabase.rpc('start_trip', {
    p_vehicle_id: vehicle.id,
    p_destination: destination.trim() || null,
  });
  if (error) throw toAppError(error);
  const row = data as TripRow;
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    plate: vehicle.plate,
    model: vehicle.model,
    imageUrl: vehicle.imageUrl,
    destination: row.destination,
    kmStart: row.km_start,
    startedAt: row.started_at,
  };
}

export async function finishTrip(driverId: string, trip: OpenTrip, kmEnd: number, signature: Blob): Promise<FinishedTrip> {
  const path = `${driverId}/${trip.id}.png`;
  try {
    const upload = await supabase.storage
      .from('signatures')
      .upload(path, signature, { contentType: 'image/png', upsert: true });
    if (upload.error) throw toAppError(upload.error);

    const { data, error } = await supabase.rpc('finish_trip', {
      p_trip_id: trip.id,
      p_km_end: kmEnd,
      p_signature_path: path,
    });
    if (error) throw toAppError(error);
    const row = data as TripRow;
    return { plate: trip.plate, model: trip.model, kmEnd: row.km_end ?? kmEnd, endedAt: row.ended_at ?? new Date().toISOString() };
  } catch (err) {
    const appError = toAppError(err);
    // A resposta pode ter se perdido depois de gravar. Se a viagem já não está aberta, deu certo.
    if (appError.code !== 'OFFLINE') {
      const stillOpen = await fetchOpenTrip().catch(() => undefined);
      if (stillOpen === null) {
        return { plate: trip.plate, model: trip.model, kmEnd, endedAt: new Date().toISOString() };
      }
    }
    throw appError;
  }
}

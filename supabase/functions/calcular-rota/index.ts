/**
 * calcular-rota: estima o KM de uma viagem finalizada pelas ruas, a partir dos pontos de GPS.
 * Chamada pelo app do condutor ao finalizar (uma vez) e pelo painel no botão "Recalcular".
 *
 * Corpo: { "tripId": "<uuid>" }
 * Aceita: o condutor da viagem (só enquanto ela está "pendente") ou um administrador ("pendente" ou "erro").
 * Grava em trips: route_status, route_km, route_geometry, route_computed_at, route_error.
 *
 * Publicar: npx supabase functions deploy calcular-rota --no-verify-jwt --project-ref <ref>
 * (quem chama é conferido aqui dentro, pelo token; ver README.)
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { classificar, type PontoViagem } from '../_shared/pontos.ts';
import { criarProvedor, RotaError } from '../_shared/rota.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Linhas por página na leitura dos pontos (limite padrão da API do Supabase). Até 5.000 por viagem. */
const PAGINA = 1000;

function responder(corpo: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return responder({ error: 'UNAUTHORIZED' }, 401);

  const corpo = (await req.json().catch(() => null)) as { tripId?: unknown } | null;
  const tripId = typeof corpo?.tripId === 'string' ? corpo.tripId : '';
  if (!UUID.test(tripId)) return responder({ error: 'TRIP_ID_INVALID' }, 400);

  // Service role: só existe aqui dentro, nunca no front-end. Ignora o RLS, por isso a checagem abaixo.
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return responder({ error: 'UNAUTHORIZED' }, 401);
  const uid = auth.user.id;

  const { data: trip, error: tripError } = await db
    .from('trips')
    .select('id, driver_id, ended_at, route_status')
    .eq('id', tripId)
    .maybeSingle();
  if (tripError) return responder({ error: 'DB_ERROR' }, 500);

  const { data: admin } = await db.from('admins').select('id').eq('id', uid).eq('active', true).maybeSingle();
  const isAdmin = Boolean(admin);
  // Viagem de outro condutor responde igual a inexistente: não revela que o id existe.
  if (!trip || (!isAdmin && trip.driver_id !== uid)) return responder({ error: 'TRIP_NOT_FOUND' }, 404);
  if (!trip.ended_at) return responder({ error: 'TRIP_OPEN' }, 409);

  // Cada cálculo gasta a cota diária do serviço de rotas: o condutor não recalcula, só dispara o primeiro.
  const permitidos = isAdmin ? ['pendente', 'erro'] : ['pendente'];
  if (!permitidos.includes(trip.route_status)) {
    return responder({ error: 'ALREADY_COMPUTED', status: trip.route_status }, 409);
  }

  const pontos: PontoViagem[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await db
      .from('trip_points')
      .select('kind, lat, lng, accuracy_m, recorded_at')
      .eq('trip_id', tripId)
      .order('recorded_at')
      .order('id')
      .range(de, de + PAGINA - 1);
    if (error) return responder({ error: 'DB_ERROR' }, 500);
    pontos.push(...(data as PontoViagem[]));
    if (data.length < PAGINA) break;
  }

  let resultado: { route_status: string; route_km: number | null; route_geometry: unknown; route_error: string | null };
  try {
    const provedor = criarProvedor((nome) => Deno.env.get(nome));
    const classe = classificar(pontos, provedor.maxPontos);
    if (classe.status === 'calcular') {
      const rota = await provedor.calcular(classe.pontos);
      resultado = {
        route_status: 'ok',
        route_km: Math.round(rota.distanciaM / 100) / 10,
        route_geometry: rota.geometria,
        route_error: null,
      };
    } else {
      resultado = { route_status: classe.status, route_km: null, route_geometry: null, route_error: null };
    }
  } catch (err) {
    const mensagem = err instanceof RotaError ? err.message : 'Erro inesperado ao calcular a rota.';
    if (!(err instanceof RotaError)) console.error(err);
    resultado = { route_status: 'erro', route_km: null, route_geometry: null, route_error: mensagem };
  }

  const { error: gravarError } = await db
    .from('trips')
    .update({ ...resultado, route_computed_at: new Date().toISOString() })
    .eq('id', tripId);
  if (gravarError) return responder({ error: 'DB_ERROR' }, 500);

  return responder({ status: resultado.route_status, routeKm: resultado.route_km, error: resultado.route_error });
});

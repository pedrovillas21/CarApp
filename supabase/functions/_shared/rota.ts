/**
 * Cálculo de rota pelas ruas, com fornecedor trocável pela variável ROUTE_PROVIDER.
 * Hoje: OpenRouteService (plano gratuito: 2.000 rotas/dia, 40/min).
 * Para trocar (OSRM, GraphHopper ou Valhalla próprios): nova implementação de Provedor + novo case em criarProvedor.
 */
import type { Coordenada } from './pontos.ts';

export type LinhaGeoJSON = { type: 'LineString'; coordinates: [number, number][] };

export type Rota = { distanciaM: number; geometria: LinhaGeoJSON };

export type Provedor = {
  /** Máximo de pontos por rota aceito pelo serviço. */
  maxPontos: number;
  calcular: (pontos: Coordenada[]) => Promise<Rota>;
};

/** Falha com mensagem pronta para o painel (gravada em trips.route_error). */
export class RotaError extends Error {}

type LerVariavel = (nome: string) => string | undefined;

export function criarProvedor(env: LerVariavel, fetchFn: typeof fetch = fetch): Provedor {
  const nome = (env('ROUTE_PROVIDER') ?? 'ors').toLowerCase();
  switch (nome) {
    case 'ors':
      return openRouteService(env('ORS_API_KEY'), fetchFn);
    default:
      throw new RotaError(`Fornecedor de rotas desconhecido: ${nome}.`);
  }
}

// ---------------------------------------------------------------------------
// OpenRouteService · https://openrouteservice.org/dev/#/api-docs/v2/directions
// Crédito obrigatório no mapa: "© openrouteservice.org by HeiGIT".

const ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';

/** Ponto do GPS fora da rua (estacionamento, prédio) é puxado para a rua mais próxima neste raio. */
const RAIO_AJUSTE_M = 500;
const TEMPO_LIMITE_MS = 20_000;

function openRouteService(chave: string | undefined, fetchFn: typeof fetch): Provedor {
  return {
    maxPontos: 50,
    async calcular(pontos) {
      if (!chave) throw new RotaError('ORS_API_KEY não configurada na Edge Function.');

      let resposta: Response;
      try {
        resposta = await fetchFn(ORS_URL, {
          method: 'POST',
          headers: {
            Authorization: chave,
            'Content-Type': 'application/json',
            Accept: 'application/geo+json',
          },
          body: JSON.stringify({
            coordinates: pontos.map((p) => [p.lng, p.lat]),
            radiuses: pontos.map(() => RAIO_AJUSTE_M),
            instructions: false,
          }),
          signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        });
      } catch {
        throw new RotaError('Serviço de rotas não respondeu. Tente recalcular mais tarde.');
      }

      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => null)) as { error?: { code?: number; message?: string } } | null;
        if (resposta.status === 429) throw new RotaError('Limite do serviço de rotas atingido. Tente recalcular mais tarde.');
        if (resposta.status === 401 || resposta.status === 403) throw new RotaError('Chave do serviço de rotas recusada (ORS_API_KEY).');
        if (corpo?.error?.code === 2010) throw new RotaError('Algum ponto ficou a mais de 500 m de uma rua.');
        throw new RotaError(`Serviço de rotas recusou o pedido (HTTP ${resposta.status}).`);
      }

      const dados = (await resposta.json()) as {
        features?: { geometry?: LinhaGeoJSON; properties?: { summary?: { distance?: number } } }[];
      };
      const rota = dados.features?.[0];
      if (!rota?.geometry) throw new RotaError('Serviço de rotas devolveu uma resposta sem rota.');

      // 5 casas decimais ≈ 1 m: suficiente para o mapa e deixa o JSON bem menor.
      const arred = (n: number) => Math.round(n * 1e5) / 1e5;
      return {
        distanciaM: rota.properties?.summary?.distance ?? 0,
        geometria: { type: 'LineString', coordinates: rota.geometry.coordinates.map(([lng, lat]) => [arred(lng), arred(lat)]) },
      };
    },
  };
}

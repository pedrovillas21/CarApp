# Plano: mapa de rotas das viagens

> **Situação:** plano aprovado em 2026-10-07 e implementado em 2026-10-08 (etapas 1 a 5). Envolve este repositório (`esbocoCarApp`) e o painel (`admCarApp`). Migração V6 aplicada e Edge Function publicada; apps ainda não publicados na data.

## Diferenças entre o plano e a implementação

- **Consentimento:** o GPS só liga com o aviso aceito (`consent === true`). Sem saber a resposta (carregando ou sem internet), fica desligado. Ao tocar em "Entendi", o app já pede a permissão do GPS.
- **Envio da fila antes de finalizar:** fica em `DriverApp.handleSigned`, e não dentro de `finishTrip`, para evitar importação circular. A ordem é a do plano. Na assinatura, o app espera até 5 s pelo ponto de retorno.
- **Fila:** lote recusado por `POINT_INVALID`/`TOO_MANY_POINTS` é descartado; `TRIP_NOT_FOUND`/`TRIP_ALREADY_FINISHED` descartam a fila toda. Filas de viagens que não estão mais abertas são apagadas ao abrir o app.
- **"Incompleta" mais ampla:** quando *todos* os pontos ficam a menos de 300 m da saída (não só saída + retorno), para não gerar aviso injusto quando o app ficou aberto só na garagem.
- **Pontos ignorados no cálculo:** precisão pior que 500 m e percursos a menos de 25 m do ponto anterior.
- **Edge Function:** publicada com `--no-verify-jwt`; o login é conferido dentro da função. O condutor só dispara o primeiro cálculo (`pendente`); o administrador recalcula `pendente` ou `erro`. Viagem de outro condutor responde como inexistente.
- **Painel:** `pendente` há mais de 5 min aparece como "Não calculada" (com Recalcular no mapa). No PDF, nota abaixo da tabela explica a regra e dá o crédito das rotas.

## Contexto

A gerência quer **conferir a rota feita em cada viagem** (não acompanhar ao vivo). Restrições levantadas:

- Celulares **pessoais** dos condutores e app em **PWA** (React + Vite na Vercel). O navegador não registra localização em segundo plano, então o GPS só é lido com o app aberto. Isso é bom para a LGPD: é impossível rastrear alguém fora da viagem.
- O rastreador dos carros não é confiável e não tem API: fica de fora.
- **Custo zero agora**, sem cartão cadastrado em nenhum serviço. O projeto deve poder atender **todos os conselhos** no futuro, então só entram peças com uso comercial permitido. Fornecedores precisam ser trocáveis por configuração.

**Resultado esperado:** no painel, cada viagem mostra no mapa os pontos registrados e a rota estimada pelas ruas, além de **KM informado × KM estimado**, com aviso quando a diferença passar do limite combinado (só em viagens normais; as de abastecimento só registram a rota). A comparação também entra no PDF.

## Serviços escolhidos (todos gratuitos, sem cartão)

| Peça | Serviço | Licença / condição | Uso |
|---|---|---|---|
| Biblioteca do mapa | **MapLibre GL JS** | BSD-3 | Só no painel |
| Imagens do mapa | **OpenFreeMap** (`https://tiles.openfreemap.org/styles/liberty`) | Grátis, sem chave, sem limite, uso comercial permitido. Sem garantia de funcionamento. | Só no painel |
| Dados do mapa | **OpenStreetMap** | ODbL: grátis, exige o crédito "© OpenStreetMap contributors" (o MapLibre mostra sozinho) | — |
| Cálculo de rota | **OpenRouteService** (plano Standard) | Grátis: 2.000 rotas/dia, 40/min. Exige conta (sem cartão) e o crédito "© openrouteservice.org by HeiGIT" | **1 cálculo por viagem**, numa Edge Function |

**Não usar:** o servidor de demonstração do OSRM (pode cortar o acesso sem aviso), o servidor de imagens do próprio OSM (proíbe uso por aplicativos), Google Maps (exige cartão) e satélite (não há opção gratuita segura).

**Planos B, para quando atender vários conselhos:** imagens via **Protomaps** (arquivo PMTiles hospedado por vocês, por exemplo no Cloudflare R2) e rotas via **OSRM, GraphHopper ou Valhalla** num servidor próprio. A troca é só configuração (ver etapas 3 e 4). **Antes de vender o sistema**, confirmar os termos do OpenRouteService para uso comercial.

## Como funciona

```
Condutor (PWA, app aberto)                Supabase                          Painel
──────────────────────────                ────────                          ──────
Inicia viagem   → ponto "saida"   ┐
"Cheguei"       → ponto "parada"  ├→ fila local → add_trip_points → trip_points
App aberto      → ponto "percurso"┘   (sobrevive a falta de sinal)
Finaliza        → ponto "retorno" → envia a fila → finish_trip
                                   → chama Edge Function calcular-rota
                                        └→ OpenRouteService (1 chamada)
                                        └→ grava route_km + geometria em trips   → mapa + KM informado × estimado
```

- O mapa do painel **não chama** a API de rotas: lê o resultado salvo. As imagens do mapa vêm do OpenFreeMap, que não tem limite.
- Sem PostGIS: latitude e longitude como `double precision` e a geometria em `jsonb` (GeoJSON) bastam para esse volume.

---

## Como o KM estimado é calculado

1. **Pontos da viagem**, em ordem de horário: saída, paradas ("Cheguei ao destino"), pontos de percurso (quando o app ficou aberto) e retorno.
2. **Pedido ao OpenRouteService:** "rota de carro passando por estes pontos, nesta ordem". É o mesmo que pedir ao GPS do celular "Sede → Destino X → Sede". O serviço usa a malha de ruas do OpenStreetMap (mão de rua, vias permitidas para carro) e escolhe o caminho **recomendado** (perfil `driving-car`, o mais rápido, que é como as pessoas dirigem de fato).
3. **Resposta:** distância total em metros (vira o **KM estimado**) e o desenho da rota (a linha do mapa).
4. **Ajuste do GPS:** um ponto do celular que caiu fora da rua (estacionamento, prédio) é "puxado" para a rua mais próxima num raio de até 500 m.
5. **Pontos de percurso** deixam a estimativa mais próxima do caminho real, porque obrigam a rota a passar por onde o carro de fato passou. Como o ORS aceita até 50 pontos por rota, sobrando pontos eles são reduzidos de forma uniforme ao longo da viagem.

**Exemplo:** Sede → Órgão X → Sede. Ida 9,8 km + volta 10,4 km = **20,2 km estimados**. Condutor informou 31 km → +53% → aviso (viagem normal, rota ≥ 10 km).

**Leitura correta do número:** o estimado é o "caminho razoável" pelos lugares registrados. O KM real é naturalmente um pouco maior (procurar vaga, desvio de trânsito, retorno errado), por isso existe a margem (50% ou 3 km).

**Limitação:** se o condutor não registrar nenhuma parada e fechar o app, só existem a saída e o retorno no mesmo lugar, e a estimativa seria ~0 km. Nesse caso a viagem fica **"Rota incompleta"**, sem aviso, para não acusar ninguém injustamente. Por isso o botão "Cheguei ao destino" é importante.

## Etapa 1: banco de dados (`esbocoCarApp`)

Nova migração `supabase/migrations/V6__rota_das_viagens.sql`, criada com `npm run db:new`, seguindo o estilo das V4 e V5 (cabeçalho, `security definer`, `set search_path = ''`, `revoke`/`grant`, códigos de erro em `raise exception using message = ...`).

**Tabela `public.trip_points`**
- `id uuid primary key`, **gerado no celular** (`crypto.randomUUID()`), para que reenviar a fila seja idempotente (`on conflict do nothing`).
- `trip_id uuid not null references trips(id) on delete cascade`
- `kind text check (kind in ('saida','parada','percurso','retorno'))`
- `lat double precision check (lat between -90 and 90)`, `lng double precision check (lng between -180 and 180)`
- `accuracy_m real`, `recorded_at timestamptz not null` (hora do aparelho), `created_at timestamptz default now()`
- Índice `(trip_id, recorded_at)`.
- RLS ligada, sem insert/update/delete direto. Política de leitura `trip_points_select_admin` usando `public.is_admin()` (o mesmo padrão da V4).

**Função `public.add_trip_points(p_trip_id uuid, p_points jsonb)`**
- Exige `is_active_driver()`, viagem do próprio condutor e **ainda aberta** (`ended_at is null`). Senão: `TRIP_NOT_FOUND` ou `TRIP_ALREADY_FINISHED`.
- Até 500 pontos por chamada e 5.000 por viagem (`TOO_MANY_POINTS`). Valida `kind`, coordenadas e `recorded_at` entre `started_at - 5 min` e `now() + 5 min` (`POINT_INVALID`).
- `insert ... on conflict (id) do nothing`.

**Novas colunas em `public.trips`** (gravadas só pela Edge Function, com a service role):
- `route_status text check (route_status in ('pendente','ok','incompleta','sem_gps','erro'))`
- `route_km numeric(8,1)`, `route_geometry jsonb`, `route_computed_at timestamptz`, `route_error text`

**Alterar `finish_trip`:** recriar a função (como a V5 fez), só acrescentando `route_status = 'pendente'` no `update`. Assinatura e regras continuam iguais.

**Consentimento:** coluna `drivers.location_consent_at timestamptz` e função `public.accept_location_terms()`, que grava `now()` para o próprio condutor. `get_my_open_trip` e o `AuthProvider` não mudam. Ler o consentimento por uma RPC simples `get_my_location_consent()`.

**Retenção:** função `public.purge_old_trip_points()`, que apaga `trip_points` e limpa `route_geometry` de viagens com mais de N meses, agendada com **pg_cron** (extensão do Supabase, gratuita). Valor de N a definir (sugestão: 12 meses).

## Etapa 2: app do condutor (`esbocoCarApp`)

**Novos arquivos**
- `src/lib/location.ts`: `getPosition()` em volta de `navigator.geolocation.getCurrentPosition` (`enableHighAccuracy: true`, `timeout: 15000`, `maximumAge: 30000`). Devolve o ponto ou `{ error: 'denied' | 'unavailable' | 'timeout' }`. **Nunca bloqueia o fluxo.**
- `src/lib/pointQueue.ts`: fila no `localStorage` por viagem (`frota:pontos:<tripId>`), com `enqueue(tripId, point)` e `flush(tripId)`. O flush chama `add_trip_points` em lotes e remove da fila o que foi aceito. Leitura e escrita com `try/catch`.
- `src/hooks/useTripTracking.ts`: enquanto a tela da viagem estiver aberta **e visível** (`document.visibilityState`), usa `watchPosition` e guarda um ponto `percurso` a cada **60 s ou 300 m**, descartando precisão pior que 100 m. Para o `watchPosition` quando a aba fica oculta. Tenta o flush ao voltar a conexão (reaproveitar `useOnline` de `src/hooks/useOnline.ts`) e a cada 10 pontos.
- `src/screens/LocationConsentScreen.tsx`: explica, uma única vez, que o GPS só é lido **durante a viagem e com o app aberto**, quem vê os dados (administração) e por quanto tempo. Botão "Entendi". Segue o visual das telas existentes (`Button`, `TopBar`, `Notice`).

**Alterações**
- `src/lib/api.ts`: tipo `TripPoint`, funções `addTripPoints`, `acceptLocationTerms`, `fetchLocationConsent`, `requestRouteCalc(tripId)` (`supabase.functions.invoke('calcular-rota')`, sem esperar resposta) e novas mensagens em `MESSAGES` (`TOO_MANY_POINTS`, `POINT_INVALID`).
  - Em `finishTrip`: antes do `rpc('finish_trip')`, `await flush(trip.id)` (uma falha aqui **não** impede finalizar). Depois do sucesso, chamar `requestRouteCalc` e limpar a fila.
- `src/DriverApp.tsx`
  - Nova tela `'consent'`, mostrada antes de `'start'` se o condutor ainda não aceitou.
  - `handleStart`: dispara `getPosition()` **em paralelo** com `startTrip`. Quando os dois terminam, enfileira o ponto `saida` com o id da viagem.
  - `onFinish` da `ActiveTripScreen`: dispara `getPosition()` e enfileira o ponto `retorno` antes de ir para `'km'`.
- `src/screens/ActiveTripScreen.tsx`: usa `useTripTracking(trip.id)`. Novo botão secundário **"Cheguei ao destino"** (pode ser usado várias vezes), que grava um ponto `parada` e mostra "Parada registrada às 14:32". Se a permissão for negada, mostra um aviso discreto ("GPS desligado: a rota não será registrada"), sem bloquear nada.
- `vercel.json`: sem mudança. A geolocalização já funciona em HTTPS. Se um `Permissions-Policy` for adicionado no futuro, incluir `geolocation=(self)`.

**Regra para permissão negada:** a viagem **segue normalmente**, e o painel marca "Sem GPS".

## Etapa 3: Edge Function `calcular-rota` (`esbocoCarApp/supabase/functions/`)

- `supabase/functions/calcular-rota/index.ts` (Deno), recebe `{ tripId }`.
- **Autorização:** com o token de quem chamou, aceita só o **condutor da viagem** ou um **admin** (`is_admin()`). Depois lê os pontos e grava o resultado com a service role (já disponível dentro da Edge Function, nunca no front-end).
- **Montagem dos pontos:** ordena por `recorded_at` e mantém sempre `saida`, `parada` e `retorno`. Os pontos de `percurso` são reduzidos de forma uniforme para caber no limite de **50 pontos** por rota do ORS.
- **Classificação:**
  - nenhum ponto → `sem_gps`;
  - só saída e retorno, a menos de 300 m um do outro e sem paradas nem percurso → `incompleta` (a rota daria ~0 km e geraria um alerta falso);
  - caso contrário, chama a rota → `ok` (ou `erro` com `route_error` em caso de falha ou de 429).
- **Fornecedor trocável:** `supabase/functions/_shared/rota.ts` define a interface `calcularRota(pontos) → { distanciaM, geometria }`. A implementação ORS usa `POST https://api.openrouteservice.org/v2/directions/driving-car/geojson`, com `radiuses` de 500 m por ponto para tolerar GPS fora da rua. Trocar por OSRM ou GraphHopper próprio = nova implementação + variável `ROUTE_PROVIDER`.
- **Segredos:** `ORS_API_KEY` com `supabase secrets set` (nunca no `.env` do front).
- **Publicação:** `npx supabase functions deploy calcular-rota` (Supabase CLI via npx, sem instalar no projeto). Documentar no README.

## Etapa 4: painel (`admCarApp`)

**Dependência:** `maplibre-gl` (BSD-3), **carregada só ao abrir o mapa** (`import()` dinâmico, o mesmo padrão já usado para o PDF em `src/lib/pdf.ts`).

**Configuração:** `VITE_MAP_STYLE_URL`, com padrão `https://tiles.openfreemap.org/styles/liberty`, em `.env.example`. Trocar por Protomaps no futuro = mudar essa variável.

**`src/lib/api.ts`**
- No `select` de `fetchTrips`, acrescentar `route_status, route_km` (a geometria **não** vem na listagem).
- Novos campos em `Trip`: `routeStatus`, `routeKm` e `kmDiff` (calculado: `kmDriven - routeKm`).
- `divergence(trip)` → `'alerta' | 'ok' | 'sem_regra'`:
  - **Só viagens `normal` geram aviso.** Viagens de `abastecimento` têm a rota registrada, calculada e exibida no mapa, mas ficam como `'sem_regra'` (sem selo de aviso).
  - Precisa de `routeStatus = 'ok'`.
  - **Rota estimada de 10 km ou mais:** aviso quando o KM informado for **50% ou mais acima** do estimado (`kmDriven >= routeKm * 1.5`). Exemplo: estimado 20 km, informado 30 km → +50% → aviso.
  - **Rota estimada abaixo de 10 km:** aviso quando o KM informado passar o estimado em **mais de 3 km** (`kmDriven - routeKm > 3`). Exemplo: estimado 6 km, informado 9 km → sem aviso; informado 9,1 km ou mais → aviso.
  - Constantes nomeadas: `DIVERGENCE_SHORT_ROUTE_KM = 10`, `DIVERGENCE_SHORT_MARGIN_KM = 3`, `DIVERGENCE_LIMIT = 0.5`. A tela mostra a diferença em km e em % ("+10 km · +50%").
- `fetchTripRoute(tripId)`: busca `route_geometry` e os `trip_points` da viagem.
- `recalcRoute(tripId)`: `functions.invoke('calcular-rota')` para viagens `pendente` ou `erro`.

**Novo `src/components/RouteDialog.tsx`**, modelado em `src/components/SignatureDialog.tsx` (`<dialog>`, estados loading, error e ready):
- Mapa MapLibre com a linha da rota (cor da marca) e marcadores: **saída** (verde), **paradas** (numeradas), **retorno**, e os pontos de percurso como pontos pequenos.
- Cabeçalho com condutor, placa, horários e **"Informado: 87 km · Estimado: 34 km · Diferença: +53 km"**.
- Créditos visíveis: OpenFreeMap, OpenMapTiles, OpenStreetMap, openrouteservice.
- Estados: "Sem GPS", "Rota incompleta (só saída e retorno no mesmo lugar)", "Calculando…" e "Erro" com o botão **Recalcular**.

**`src/screens/TripsScreen.tsx`**
- Nova coluna **"Rota"**: KM estimado, selo de divergência e botão "Ver mapa" (abre o `RouteDialog`, como o botão de assinatura faz hoje).
- Novo cartão de totais: **"Viagens com divergência"** (conta só viagens normais).
- Novo filtro opcional: "Só com divergência".

**`src/lib/pdf.ts`:** colunas "KM estimado" e "Diferença" na tabela de viagens, e o total de viagens com divergência no resumo.

## Etapa 5: documentação e LGPD

- READMEs dos dois repositórios: criar a conta no ORS, `supabase secrets set ORS_API_KEY=...`, publicar a função, a variável `VITE_MAP_STYLE_URL`, os créditos obrigatórios e uma seção **"Localização e LGPD"** (o que é coletado, quando, quem vê e por quanto tempo).
- **Para a gerência providenciar:** norma ou portaria interna informando os condutores sobre o registro de localização durante as viagens.

## Decisões a confirmar com a gerência (padrões adotados no plano)

1. Permissão de GPS negada: **a viagem segue** e o painel marca "Sem GPS".
2. Retenção dos pontos e rotas: **12 meses**.
3. ~~Limite de divergência~~ **definido:** só para viagens **normais**. Rota estimada ≥ 10 km: aviso a partir de **+50%**. Rota estimada < 10 km: aviso acima de **+3 km**. Viagens de abastecimento só registram a rota. Pontos ainda em aberto: (a) exatamente 10 km entra na regra do percentual; (b) KM informado **abaixo** do estimado não gera aviso (pode indicar erro de digitação do KM).
4. Frequência dos pontos de percurso com o app aberto: **60 s ou 300 m**.

## Futuro: vários conselhos (fora deste plano)

Antes do segundo conselho entrar, criar o conceito de **conselho** no banco (`conselho_id` nas tabelas e RLS por conselho) e confirmar os termos comerciais do ORS, ou instalar um servidor de rotas próprio.

## Verificação

1. `npm run db:migrate` e `npm run db:info` no `esbocoCarApp`. Testar `add_trip_points` com viagem aberta (aceita), viagem fechada (`TRIP_ALREADY_FINISHED`) e viagem de outro condutor (`TRIP_NOT_FOUND`). Reenviar o mesmo lote não duplica pontos.
2. App do condutor (`npm run dev`, no navegador do celular ou no navegador interno com localização simulada): primeiro uso mostra o consentimento; iniciar viagem grava `saida`; "Cheguei ao destino" grava `parada`; desligar a internet, registrar pontos, religar e ver a fila ser enviada; finalizar grava `retorno` e deixa `route_status` em `pendente` e depois `ok`.
3. Negar a permissão de localização: a viagem inicia e finaliza normalmente e termina com `sem_gps`.
4. Edge Function: viagem com só saída e retorno no mesmo lugar → `incompleta`; viagem com parada → `ok` com `route_km` coerente; chamada por um condutor que não é dono da viagem → recusada.
5. Painel (`npm run dev`, porta 5174): coluna Rota, selo de divergência (normal, estimado 20 km: informado 29 km → sem aviso, 30 km → aviso; normal, estimado 6 km: informado 9 km → sem aviso, 9,5 km → aviso; abastecimento com qualquer diferença → sem aviso, mas com mapa), mapa com marcadores e créditos, Recalcular em `erro`, PDF com as novas colunas. `npm run build` sem erros nos dois projetos.

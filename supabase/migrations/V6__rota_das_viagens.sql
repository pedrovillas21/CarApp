-- rota das viagens
-- Criada em 2026-10-07. Depois de aplicada, não edite: crie outra migração.
-- O app do condutor registra pontos de GPS durante a viagem (só com o app aberto).
-- Ao finalizar, a Edge Function calcular-rota estima o KM pelas ruas e grava o resultado em trips.
-- O painel compara KM informado × KM estimado. Pontos e desenho da rota são apagados após 12 meses.

-- ---------------------------------------------------------------------------
-- Pontos da viagem

-- O id é gerado no celular: reenviar a fila de pontos não duplica nada.
create table public.trip_points (
  id          uuid primary key,
  trip_id     uuid not null references public.trips (id) on delete cascade,
  kind        text not null check (kind in ('saida', 'parada', 'percurso', 'retorno')),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  accuracy_m  real check (accuracy_m is null or accuracy_m >= 0),
  recorded_at timestamptz not null, -- hora do aparelho
  created_at  timestamptz not null default now()
);

create index trip_points_trip_recorded_idx on public.trip_points (trip_id, recorded_at);

-- Gravação só por add_trip_points; leitura só pelos administradores.
alter table public.trip_points enable row level security;

revoke all on public.trip_points from anon;
revoke insert, update, delete, truncate on public.trip_points from authenticated;

create policy trip_points_select_admin on public.trip_points
  for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Resultado da rota (gravado só pela Edge Function, com a service role)

-- route_status nulo: viagem anterior a esta funcionalidade.
alter table public.trips
  add column route_status text
    check (route_status in ('pendente', 'ok', 'incompleta', 'sem_gps', 'erro')),
  add column route_km          numeric(8, 1) check (route_km >= 0),
  add column route_geometry    jsonb, -- GeoJSON LineString
  add column route_computed_at timestamptz,
  add column route_error       text;

-- ---------------------------------------------------------------------------
-- Consentimento de localização

alter table public.drivers add column location_consent_at timestamptz;

create function public.accept_location_terms()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at timestamptz;
begin
  if not public.is_active_driver() then
    raise exception using message = 'NOT_A_DRIVER';
  end if;

  update public.drivers
  set location_consent_at = now()
  where id = auth.uid()
  returning location_consent_at into v_at;

  return v_at;
end;
$$;

create function public.get_my_location_consent()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select d.location_consent_at
  from public.drivers d
  where d.id = auth.uid() and d.active;
$$;

-- ---------------------------------------------------------------------------
-- Gravação dos pontos

-- Recebe um lote da fila do celular: [{ id, kind, lat, lng, accuracy_m, recorded_at }, ...]
-- Só aceita enquanto a viagem do próprio condutor está aberta. Devolve quantos pontos eram novos.
create function public.add_trip_points(p_trip_id uuid, p_points jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_trip     public.trips;
  v_points   public.trip_points[];
  v_existing integer;
  v_new      integer;
  v_inserted integer;
begin
  if not public.is_active_driver() then
    raise exception using message = 'NOT_A_DRIVER';
  end if;

  -- Trava a viagem: nenhum ponto entra depois que finish_trip a fecha.
  select * into v_trip from public.trips where id = p_trip_id and driver_id = v_uid for update;
  if not found then
    raise exception using message = 'TRIP_NOT_FOUND';
  end if;
  if v_trip.ended_at is not null then
    raise exception using message = 'TRIP_ALREADY_FINISHED';
  end if;

  if jsonb_typeof(p_points) is distinct from 'array' then
    raise exception using message = 'POINT_INVALID';
  end if;
  if jsonb_array_length(p_points) = 0 then
    return 0;
  end if;
  -- Até 500 por chamada. Igual ao tamanho do lote em pointQueue.ts no front-end.
  if jsonb_array_length(p_points) > 500 then
    raise exception using message = 'TOO_MANY_POINTS';
  end if;

  -- Tipos errados (id que não é uuid, data ilegível, coordenada em texto) viram POINT_INVALID.
  begin
    select coalesce(array_agg(p), '{}') into v_points
    from jsonb_populate_recordset(null::public.trip_points, p_points) p;
  exception when data_exception then
    raise exception using message = 'POINT_INVALID';
  end;

  -- Hora do aparelho: tolera 5 min de relógio adiantado ou atrasado.
  if exists (
    select 1 from unnest(v_points) p
    where p.id is null
       or p.kind is null or p.kind not in ('saida', 'parada', 'percurso', 'retorno')
       or p.lat is null or p.lat not between -90 and 90
       or p.lng is null or p.lng not between -180 and 180
       or (p.accuracy_m is not null and p.accuracy_m not between 0 and 1000000)
       or p.recorded_at is null
       or p.recorded_at < v_trip.started_at - interval '5 minutes'
       or p.recorded_at > now() + interval '5 minutes'
  ) then
    raise exception using message = 'POINT_INVALID';
  end if;

  -- Até 5.000 por viagem. Pontos reenviados não contam de novo.
  select count(*) into v_existing from public.trip_points where trip_id = p_trip_id;
  select count(distinct p.id) into v_new
  from unnest(v_points) p
  where not exists (select 1 from public.trip_points t where t.id = p.id);
  if v_existing + v_new > 5000 then
    raise exception using message = 'TOO_MANY_POINTS';
  end if;

  insert into public.trip_points (id, trip_id, kind, lat, lng, accuracy_m, recorded_at)
  select p.id, p_trip_id, p.kind, p.lat, p.lng, p.accuracy_m, p.recorded_at
  from unnest(v_points) p
  on conflict (id) do nothing;
  get diagnostics v_inserted = row_count;

  return v_inserted;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retorno: igual à V5, só marca a rota como pendente para a Edge Function calcular.
-- Mesma assinatura: create or replace mantém as permissões.

create or replace function public.finish_trip(
  p_trip_id              uuid,
  p_km_end               integer,
  p_signature_path       text,
  p_fuel_type            text default null,
  p_fuel_gasoline_amount numeric default null,
  p_fuel_electric_amount numeric default null
)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_trip public.trips;
begin
  if not public.is_active_driver() then
    raise exception using message = 'NOT_A_DRIVER';
  end if;

  select * into v_trip from public.trips where id = p_trip_id and driver_id = v_uid for update;
  if not found then
    raise exception using message = 'TRIP_NOT_FOUND';
  end if;
  if v_trip.ended_at is not null then
    raise exception using message = 'TRIP_ALREADY_FINISHED';
  end if;

  if p_km_end is null or p_km_end < v_trip.km_start then
    raise exception using message = 'KM_END_INVALID', detail = v_trip.km_start::text;
  end if;
  -- Trava contra dígito a mais (ex.: 482620 em vez de 48262). Igual a KM_MAX_DIFF no front-end.
  if p_km_end - v_trip.km_start > 5000 then
    raise exception using message = 'KM_END_TOO_HIGH', detail = v_trip.km_start::text;
  end if;

  if p_fuel_type is null then
    if v_trip.trip_type = 'abastecimento' then
      raise exception using message = 'FUEL_REQUIRED';
    end if;
    if p_fuel_gasoline_amount is not null or p_fuel_electric_amount is not null then
      raise exception using message = 'FUEL_INVALID';
    end if;
  else
    if p_fuel_type not in ('gasolina', 'eletricidade', 'ambos')
      or (p_fuel_type = 'gasolina' and p_fuel_electric_amount is not null)
      or (p_fuel_type = 'eletricidade' and p_fuel_gasoline_amount is not null) then
      raise exception using message = 'FUEL_INVALID';
    end if;
    -- Valor de cada combustível: maior que zero, até 5.000. Igual a FUEL_MAX_AMOUNT no front-end.
    if (p_fuel_type in ('gasolina', 'ambos')
          and (p_fuel_gasoline_amount is null or round(p_fuel_gasoline_amount, 2) <= 0 or p_fuel_gasoline_amount > 5000))
      or (p_fuel_type in ('eletricidade', 'ambos')
          and (p_fuel_electric_amount is null or round(p_fuel_electric_amount, 2) <= 0 or p_fuel_electric_amount > 5000)) then
      raise exception using message = 'FUEL_AMOUNT_INVALID';
    end if;
  end if;

  if p_signature_path is distinct from (v_uid::text || '/' || p_trip_id::text || '.png') then
    raise exception using message = 'SIGNATURE_INVALID';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'signatures' and o.name = p_signature_path
  ) then
    raise exception using message = 'SIGNATURE_MISSING';
  end if;

  update public.trips
  set km_end = p_km_end,
      ended_at = now(),
      signature_path = p_signature_path,
      fuel_type = p_fuel_type,
      fuel_gasoline_amount = round(p_fuel_gasoline_amount, 2),
      fuel_electric_amount = round(p_fuel_electric_amount, 2),
      route_status = 'pendente'
  where id = p_trip_id
  returning * into v_trip;

  update public.vehicles
  set current_km = p_km_end, updated_at = now()
  where id = v_trip.vehicle_id;

  return v_trip;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retenção (LGPD): após 12 meses apaga os pontos e o desenho da rota.
-- O KM estimado (route_km) fica, porque é só um número do relatório.

create function public.purge_old_trip_points(p_months integer default 12)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff  timestamptz := now() - make_interval(months => p_months);
  v_deleted integer;
begin
  delete from public.trip_points p
  using public.trips t
  where t.id = p.trip_id and t.started_at < v_cutoff;
  get diagnostics v_deleted = row_count;

  update public.trips
  set route_geometry = null
  where started_at < v_cutoff and route_geometry is not null;

  return v_deleted;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões

revoke execute on function public.accept_location_terms() from public, anon;
revoke execute on function public.get_my_location_consent() from public, anon;
revoke execute on function public.add_trip_points(uuid, jsonb) from public, anon;
grant execute on function public.accept_location_terms() to authenticated;
grant execute on function public.get_my_location_consent() to authenticated;
grant execute on function public.add_trip_points(uuid, jsonb) to authenticated;

-- A limpeza roda só pelo agendamento abaixo, nunca pelo app.
revoke execute on function public.purge_old_trip_points(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Agendamento: todo dia às 03:30 de Brasília (06:30 UTC). Com o mesmo nome, cron.schedule atualiza.

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'frota-limpar-pontos-antigos',
  '30 6 * * *',
  $job$select public.purge_old_trip_points()$job$
);

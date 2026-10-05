-- Estrutura inicial do controle de frota.
-- Condutores autorizados, veículos, viagens e o bucket das assinaturas.
-- Toda gravação passa por funções (start_trip, finish_trip); as tabelas são só leitura para o app.

-- ---------------------------------------------------------------------------
-- Tabelas

-- Só quem está nesta tabela (e ativo) usa o app. Linhas criadas por: npm run user:create
create table public.drivers (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null check (char_length(btrim(full_name)) between 2 and 120),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.vehicles (
  id         uuid primary key default gen_random_uuid(),
  plate      text not null unique check (plate ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  model      text not null check (char_length(btrim(model)) between 2 and 80),
  current_km integer not null check (current_km >= 0),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cada linha é uma viagem. Os dados de relatório (duração, km rodados) ficam prontos aqui
-- para o futuro sistema administrativo; o app do condutor não mostra histórico.
create table public.trips (
  id               uuid primary key default gen_random_uuid(),
  vehicle_id       uuid not null references public.vehicles (id),
  driver_id        uuid not null references public.drivers (id),
  destination      text check (destination is null or char_length(destination) <= 200),
  km_start         integer not null check (km_start >= 0),
  km_end           integer,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  signature_path   text,
  duration_seconds integer generated always as (
    floor(extract(epoch from (ended_at - started_at)))::integer
  ) stored,
  km_driven        integer generated always as (km_end - km_start) stored,
  created_at       timestamptz not null default now(),
  constraint trips_km_end_valid check (km_end is null or km_end >= km_start),
  constraint trips_end_after_start check (ended_at is null or ended_at >= started_at),
  constraint trips_closed_complete check (
    (ended_at is null and km_end is null and signature_path is null)
    or (ended_at is not null and km_end is not null and signature_path is not null)
  )
);

-- Um carro só pode ter uma viagem aberta, e um condutor também.
create unique index trips_one_open_per_vehicle on public.trips (vehicle_id) where ended_at is null;
create unique index trips_one_open_per_driver on public.trips (driver_id) where ended_at is null;
create index trips_driver_started_idx on public.trips (driver_id, started_at desc);
create index trips_vehicle_started_idx on public.trips (vehicle_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Segurança (RLS)

alter table public.drivers enable row level security;
alter table public.vehicles enable row level security;
alter table public.trips enable row level security;

revoke all on public.drivers, public.vehicles, public.trips from anon;
revoke insert, update, delete, truncate on public.drivers, public.vehicles, public.trips from authenticated;

create function public.is_active_driver()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.drivers d
    where d.id = auth.uid() and d.active
  );
$$;

create policy drivers_select_self on public.drivers
  for select to authenticated
  using (id = (select auth.uid()));

create policy vehicles_select_drivers on public.vehicles
  for select to authenticated
  using ((select public.is_active_driver()));

create policy trips_select_own on public.trips
  for select to authenticated
  using (driver_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Leitura

-- Frota com status: disponível ou em uso (por quem e desde quando).
create function public.get_fleet()
returns table (
  id              uuid,
  plate           text,
  model           text,
  current_km      integer,
  in_use          boolean,
  driver_name     text,
  trip_started_at timestamptz,
  is_mine         boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    v.id,
    v.plate,
    v.model,
    v.current_km,
    t.id is not null,
    d.full_name,
    t.started_at,
    coalesce(t.driver_id = auth.uid(), false)
  from public.vehicles v
  left join public.trips t on t.vehicle_id = v.id and t.ended_at is null
  left join public.drivers d on d.id = t.driver_id
  where v.active and public.is_active_driver()
  order by t.id is not null, v.model, v.plate;
$$;

-- Viagem em aberto do condutor logado (no máximo uma).
create function public.get_my_open_trip()
returns table (
  id          uuid,
  vehicle_id  uuid,
  plate       text,
  model       text,
  destination text,
  km_start    integer,
  started_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.vehicle_id, v.plate, v.model, t.destination, t.km_start, t.started_at
  from public.trips t
  join public.vehicles v on v.id = t.vehicle_id
  where t.driver_id = auth.uid()
    and t.ended_at is null
    and public.is_active_driver();
$$;

-- ---------------------------------------------------------------------------
-- Gravação

-- Saída: o KM inicial vem sempre do banco (current_km do veículo).
create function public.start_trip(p_vehicle_id uuid, p_destination text default null)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_vehicle public.vehicles;
  v_trip    public.trips;
  v_holder  record;
begin
  if not public.is_active_driver() then
    raise exception using message = 'NOT_A_DRIVER';
  end if;

  -- Trava o veículo: duas saídas simultâneas do mesmo carro entram em fila aqui.
  select * into v_vehicle from public.vehicles where id = p_vehicle_id and active for update;
  if not found then
    raise exception using message = 'VEHICLE_NOT_FOUND';
  end if;

  if exists (select 1 from public.trips where driver_id = v_uid and ended_at is null) then
    raise exception using message = 'DRIVER_HAS_OPEN_TRIP';
  end if;

  select d.full_name, t.started_at into v_holder
  from public.trips t
  join public.drivers d on d.id = t.driver_id
  where t.vehicle_id = p_vehicle_id and t.ended_at is null;
  if found then
    raise exception using
      message = 'VEHICLE_IN_USE',
      detail = json_build_object('driver', v_holder.full_name, 'started_at', v_holder.started_at)::text;
  end if;

  insert into public.trips (vehicle_id, driver_id, destination, km_start)
  values (p_vehicle_id, v_uid, nullif(btrim(p_destination), ''), v_vehicle.current_km)
  returning * into v_trip;

  return v_trip;
end;
$$;

-- Retorno: grava KM final e assinatura e atualiza o KM do veículo, tudo na mesma transação.
create function public.finish_trip(p_trip_id uuid, p_km_end integer, p_signature_path text)
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
  set km_end = p_km_end, ended_at = now(), signature_path = p_signature_path
  where id = p_trip_id
  returning * into v_trip;

  update public.vehicles
  set current_km = p_km_end, updated_at = now()
  where id = v_trip.vehicle_id;

  return v_trip;
end;
$$;

-- Só usuários logados chamam as funções; o anon não.
revoke execute on function public.is_active_driver() from public, anon;
revoke execute on function public.get_fleet() from public, anon;
revoke execute on function public.get_my_open_trip() from public, anon;
revoke execute on function public.start_trip(uuid, text) from public, anon;
revoke execute on function public.finish_trip(uuid, integer, text) from public, anon;
grant execute on function public.is_active_driver() to authenticated;
grant execute on function public.get_fleet() to authenticated;
grant execute on function public.get_my_open_trip() to authenticated;
grant execute on function public.start_trip(uuid, text) to authenticated;
grant execute on function public.finish_trip(uuid, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Assinaturas (Storage)

-- Bucket privado, só PNG, até 512 KB. Caminho: <id do condutor>/<id da viagem>.png
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signatures', 'signatures', false, 524288, array['image/png'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- O condutor só envia (ou reenvia) a assinatura da própria viagem enquanto ela está aberta.
create policy frota_signatures_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'signatures'
    and exists (
      select 1 from public.trips t
      where t.driver_id = (select auth.uid())
        and t.ended_at is null
        and name = (select auth.uid())::text || '/' || t.id::text || '.png'
    )
  );

create policy frota_signatures_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'signatures'
    and exists (
      select 1 from public.trips t
      where t.driver_id = (select auth.uid())
        and t.ended_at is null
        and name = (select auth.uid())::text || '/' || t.id::text || '.png'
    )
  )
  with check (
    bucket_id = 'signatures'
    and exists (
      select 1 from public.trips t
      where t.driver_id = (select auth.uid())
        and t.ended_at is null
        and name = (select auth.uid())::text || '/' || t.id::text || '.png'
    )
  );

create policy frota_signatures_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

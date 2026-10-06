-- tipo de viagem e abastecimento
-- Criada em 2026-10-06. Depois de aplicada, não edite: crie outra migração.
-- Na saída o condutor escolhe o tipo: viagem normal ou de abastecimento (só para controle).
-- No retorno informa o que abasteceu (gasolina, eletricidade ou os dois) e o valor de cada um.
-- Obrigatório na viagem de abastecimento; opcional na normal.

alter table public.trips
  add column trip_type text not null default 'normal'
    check (trip_type in ('normal', 'abastecimento')),
  add column fuel_type text
    check (fuel_type in ('gasolina', 'eletricidade', 'ambos')),
  add column fuel_gasoline_amount numeric(10, 2) check (fuel_gasoline_amount > 0),
  add column fuel_electric_amount numeric(10, 2) check (fuel_electric_amount > 0),
  add column fuel_total numeric(10, 2) generated always as (
    coalesce(fuel_gasoline_amount, 0) + coalesce(fuel_electric_amount, 0)
  ) stored;

-- Cada combustível informado tem o seu valor, e só ele.
alter table public.trips add constraint trips_fuel_consistent check (
  (fuel_type is null and fuel_gasoline_amount is null and fuel_electric_amount is null)
  or (fuel_type = 'gasolina' and fuel_gasoline_amount is not null and fuel_electric_amount is null)
  or (fuel_type = 'eletricidade' and fuel_electric_amount is not null and fuel_gasoline_amount is null)
  or (fuel_type = 'ambos' and fuel_gasoline_amount is not null and fuel_electric_amount is not null)
);

-- Viagem de abastecimento só fecha com o abastecimento informado.
alter table public.trips add constraint trips_refuel_complete check (
  trip_type <> 'abastecimento' or ended_at is null or fuel_type is not null
);

-- As funções mudam de parâmetros e de retorno: é preciso recriar.
drop function public.get_my_open_trip();
drop function public.start_trip(uuid, text);
drop function public.finish_trip(uuid, integer, text);

create function public.get_my_open_trip()
returns table (
  id          uuid,
  vehicle_id  uuid,
  plate       text,
  model       text,
  image_url   text,
  destination text,
  km_start    integer,
  started_at  timestamptz,
  trip_type   text
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.vehicle_id, v.plate, v.model, v.image_url, t.destination, t.km_start, t.started_at, t.trip_type
  from public.trips t
  join public.vehicles v on v.id = t.vehicle_id
  where t.driver_id = auth.uid()
    and t.ended_at is null
    and public.is_active_driver();
$$;

-- Saída: o KM inicial vem sempre do banco (current_km do veículo).
create function public.start_trip(
  p_vehicle_id  uuid,
  p_destination text default null,
  p_trip_type   text default 'normal'
)
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

  if p_trip_type is null or p_trip_type not in ('normal', 'abastecimento') then
    raise exception using message = 'TRIP_TYPE_INVALID';
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

  insert into public.trips (vehicle_id, driver_id, destination, km_start, trip_type)
  values (p_vehicle_id, v_uid, nullif(btrim(p_destination), ''), v_vehicle.current_km, p_trip_type)
  returning * into v_trip;

  return v_trip;
end;
$$;

-- Retorno: grava KM final, abastecimento e assinatura e atualiza o KM do veículo, tudo na mesma transação.
create function public.finish_trip(
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
      fuel_electric_amount = round(p_fuel_electric_amount, 2)
  where id = p_trip_id
  returning * into v_trip;

  update public.vehicles
  set current_km = p_km_end, updated_at = now()
  where id = v_trip.vehicle_id;

  return v_trip;
end;
$$;

revoke execute on function public.get_my_open_trip() from public, anon;
revoke execute on function public.start_trip(uuid, text, text) from public, anon;
revoke execute on function public.finish_trip(uuid, integer, text, text, numeric, numeric) from public, anon;
grant execute on function public.get_my_open_trip() to authenticated;
grant execute on function public.start_trip(uuid, text, text) to authenticated;
grant execute on function public.finish_trip(uuid, integer, text, text, numeric, numeric) to authenticated;

-- Relatórios de gasto com combustível por período.
create index trips_refuel_started_idx on public.trips (started_at desc) where fuel_type is not null;

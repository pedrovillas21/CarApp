-- imagem dos veiculos
-- Criada em 2026-10-05. Depois de aplicada, não edite: crie outra migração.
-- Foto ilustrativa do modelo, mostrada na escolha do carro (estilo app de corrida).
-- Caminho de arquivo em public/vehicles/ ou URL completa. Sem imagem, o app mostra só a placa.

alter table public.vehicles add column image_url text;

update public.vehicles set image_url = '/vehicles/byd-king.webp' where model = 'BYD King';

-- As funções de leitura passam a devolver a imagem (mudar o retorno exige recriar).
drop function public.get_fleet();
drop function public.get_my_open_trip();

create function public.get_fleet()
returns table (
  id              uuid,
  plate           text,
  model           text,
  current_km      integer,
  image_url       text,
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
    v.image_url,
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

create function public.get_my_open_trip()
returns table (
  id          uuid,
  vehicle_id  uuid,
  plate       text,
  model       text,
  image_url   text,
  destination text,
  km_start    integer,
  started_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.vehicle_id, v.plate, v.model, v.image_url, t.destination, t.km_start, t.started_at
  from public.trips t
  join public.vehicles v on v.id = t.vehicle_id
  where t.driver_id = auth.uid()
    and t.ended_at is null
    and public.is_active_driver();
$$;

revoke execute on function public.get_fleet() from public, anon;
revoke execute on function public.get_my_open_trip() from public, anon;
grant execute on function public.get_fleet() to authenticated;
grant execute on function public.get_my_open_trip() to authenticated;

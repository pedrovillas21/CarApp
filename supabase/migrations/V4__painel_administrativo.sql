-- painel administrativo
-- Criada em 2026-10-06. Depois de aplicada, não edite: crie outra migração.
-- Administradores leem todas as viagens, condutores, veículos e assinaturas (só leitura).
-- Linhas criadas por: npm run admin:create

create table public.admins (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null check (char_length(btrim(full_name)) between 2 and 120),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

revoke all on public.admins from anon;
revoke insert, update, delete, truncate on public.admins from authenticated;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a
    where a.id = auth.uid() and a.active
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- O painel confere se quem entrou é administrador lendo a própria linha.
create policy admins_select_self on public.admins
  for select to authenticated
  using (id = (select auth.uid()));

-- Políticas somam com as dos condutores (permissivas): o condutor continua vendo só o que já via.
create policy drivers_select_admin on public.drivers
  for select to authenticated
  using ((select public.is_admin()));

create policy vehicles_select_admin on public.vehicles
  for select to authenticated
  using ((select public.is_admin()));

create policy trips_select_admin on public.trips
  for select to authenticated
  using ((select public.is_admin()));

create policy frota_signatures_select_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'signatures' and (select public.is_admin()));

-- Relatórios filtram por período.
create index trips_started_idx on public.trips (started_at desc);

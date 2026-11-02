begin;

create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (full_name is null or char_length(full_name) between 1 and 120),
  locale text not null default 'fr' check (locale ~ '^[a-z]{2}(?:-[A-Z]{2})?$'),
  timezone text not null default 'Africa/Niamey' check (char_length(timezone) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  currency_code text not null default 'XOF',
  timezone text not null default 'Africa/Niamey',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_name_valid check (name = btrim(name) and char_length(name) between 2 and 120),
  constraint tenants_slug_valid check (
    char_length(slug) between 2 and 63
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint tenants_currency_valid check (currency_code ~ '^[A-Z]{3}$'),
  constraint tenants_timezone_valid check (char_length(timezone) between 1 and 100),
  constraint tenants_status_valid check (status in ('active', 'suspended'))
);

comment on table public.tenants is 'A tenant is an isolated business owned and accessed through memberships.';

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_tenant_id_id_unique unique (tenant_id, id),
  constraint roles_tenant_name_unique unique (tenant_id, name),
  constraint roles_name_valid check (name = btrim(name) and char_length(name) between 2 and 80)
);

create table public.permissions (
  code text primary key,
  description text not null,
  constraint permissions_code_valid check (code ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$')
);

create table public.role_permissions (
  tenant_id uuid not null,
  role_id uuid not null,
  permission_code text not null references public.permissions(code) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_code),
  constraint role_permissions_role_same_tenant foreign key (tenant_id, role_id)
    references public.roles(tenant_id, id) on delete cascade
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memberships_tenant_user_unique unique (tenant_id, user_id),
  constraint memberships_role_same_tenant foreign key (tenant_id, role_id)
    references public.roles(tenant_id, id) on delete restrict,
  constraint memberships_status_valid check (status in ('invited', 'active', 'suspended'))
);

create index memberships_user_id_idx on public.memberships(user_id);
create index memberships_role_id_idx on public.memberships(role_id);
create index roles_tenant_id_idx on public.roles(tenant_id);
create index role_permissions_tenant_id_idx on public.role_permissions(tenant_id);
create index role_permissions_permission_code_idx on public.role_permissions(permission_code);

insert into public.permissions(code, description) values
  ('tenant.read', 'Consulter les informations de l’entreprise'),
  ('tenant.manage', 'Modifier les informations de l’entreprise'),
  ('members.read', 'Consulter les membres et leurs rôles'),
  ('members.manage', 'Inviter et gérer les membres'),
  ('catalog.read', 'Consulter le catalogue'),
  ('catalog.manage', 'Gérer les produits et catégories'),
  ('inventory.read', 'Consulter les stocks'),
  ('inventory.manage', 'Gérer les mouvements et inventaires'),
  ('sales.read', 'Consulter les ventes'),
  ('sales.manage', 'Enregistrer les ventes et retours'),
  ('stores.read', 'Consulter les boutiques'),
  ('stores.manage', 'Créer et personnaliser les boutiques'),
  ('reports.read', 'Consulter les rapports'),
  ('reports.manage', 'Configurer les rapports et notifications'),
  ('audit.read', 'Consulter la traçabilité')
on conflict (code) do update set description = excluded.description;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger tenants_set_updated_at before update on public.tenants
for each row execute function public.set_updated_at();
create trigger roles_set_updated_at before update on public.roles
for each row execute function public.set_updated_at();
create trigger memberships_set_updated_at before update on public.memberships
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, full_name)
  values (
    new.id,
    nullif(left(new.raw_user_meta_data ->> 'full_name', 120), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships as membership
    where membership.tenant_id = target_tenant_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  );
$$;

create or replace function public.has_tenant_permission(
  target_tenant_id uuid,
  target_permission text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships as membership
    join public.role_permissions as role_permission
      on role_permission.role_id = membership.role_id
     and role_permission.tenant_id = membership.tenant_id
    where membership.tenant_id = target_tenant_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and role_permission.permission_code = target_permission
  );
$$;

create or replace function public.create_tenant(
  p_name text,
  p_slug text,
  p_currency_code text default 'XOF',
  p_timezone text default 'Africa/Niamey'
)
returns public.tenants
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  created_tenant public.tenants%rowtype;
  owner_role_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from auth.users as auth_user
    where auth_user.id = current_user_id
      and auth_user.email_confirmed_at is not null
  ) then
    raise exception 'A confirmed email is required' using errcode = '42501';
  end if;

  if p_name is null or p_name <> btrim(p_name) or char_length(p_name) not between 2 and 120 then
    raise exception 'Invalid tenant name' using errcode = '22023';
  end if;

  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(p_slug) not between 2 and 63 then
    raise exception 'Invalid tenant slug' using errcode = '22023';
  end if;

  if p_currency_code is null or p_currency_code !~ '^[A-Z]{3}$' then
    raise exception 'Invalid currency' using errcode = '22023';
  end if;

  if p_timezone is null or char_length(p_timezone) not between 1 and 100
    or not exists (
      select 1 from pg_catalog.pg_timezone_names as timezone_name
      where timezone_name.name = p_timezone
    ) then
    raise exception 'Invalid timezone' using errcode = '22023';
  end if;

  insert into public.tenants(name, slug, currency_code, timezone)
  values (p_name, p_slug, p_currency_code, p_timezone)
  returning * into created_tenant;

  insert into public.roles(tenant_id, name, description, is_system)
  values (
    created_tenant.id,
    'Propriétaire',
    'Accès complet à l’entreprise',
    true
  )
  returning id into owner_role_id;

  insert into public.role_permissions(tenant_id, role_id, permission_code)
  select created_tenant.id, owner_role_id, permission.code
  from public.permissions as permission;

  insert into public.memberships(tenant_id, user_id, role_id, status)
  values (created_tenant.id, current_user_id, owner_role_id, 'active');

  return created_tenant;
end;
$$;

alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.memberships enable row level security;

create policy profiles_select_own on public.profiles
for select to authenticated
using ((select auth.uid()) = id);

create policy profiles_update_own on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy tenants_select_members on public.tenants
for select to authenticated
using (public.is_tenant_member(id));

create policy memberships_select_members on public.memberships
for select to authenticated
using (public.is_tenant_member(tenant_id));

create policy roles_select_members on public.roles
for select to authenticated
using (public.is_tenant_member(tenant_id));

create policy role_permissions_select_members on public.role_permissions
for select to authenticated
using (public.is_tenant_member(tenant_id));

create policy permissions_select_authenticated on public.permissions
for select to authenticated
using (true);

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.tenants from anon, authenticated;
revoke all on table public.roles from anon, authenticated;
revoke all on table public.permissions from anon, authenticated;
revoke all on table public.role_permissions from anon, authenticated;
revoke all on table public.memberships from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update(full_name, locale, timezone) on table public.profiles to authenticated;
grant select on table public.tenants to authenticated;
grant select on table public.roles to authenticated;
grant select on table public.permissions to authenticated;
grant select on table public.role_permissions to authenticated;
grant select on table public.memberships to authenticated;

revoke all on function public.handle_new_user() from public;
revoke all on function public.is_tenant_member(uuid) from public;
revoke all on function public.has_tenant_permission(uuid, text) from public;
revoke all on function public.create_tenant(text, text, text, text) from public;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.has_tenant_permission(uuid, text) to authenticated;
grant execute on function public.create_tenant(text, text, text, text) to authenticated;

commit;

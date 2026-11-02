-- Rôles standard, invitations et lecture de l'équipe.
-- Objectif : permettre à plusieurs personnes de travailler dans la même entreprise,
-- chacune avec un rôle limité (vendeur, magasinier, gestionnaire…).

-- ---------------------------------------------------------------------------
-- 1. Rôles standard par entreprise (idempotent, appelé à la demande)
-- ---------------------------------------------------------------------------
create or replace function public.ensure_tenant_roles(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  template record;
  role_id uuid;
begin
  for template in
    select *
    from (
      values
        (
          'Propriétaire',
          'Accès complet à l’entreprise',
          array[
            'audit.read','catalog.manage','catalog.read','inventory.manage','inventory.read',
            'members.manage','members.read','reports.manage','reports.read','sales.manage',
            'sales.read','stores.manage','stores.read','tenant.manage','tenant.read'
          ]
        ),
        (
          'Gestionnaire',
          'Catalogue, stock, rapports et équipe',
          array[
            'audit.read','catalog.manage','catalog.read','inventory.manage','inventory.read',
            'members.read','reports.read','sales.read','stores.manage','stores.read','tenant.read'
          ]
        ),
        (
          'Magasinier',
          'Réception, sorties et inventaires',
          array['catalog.read','inventory.manage','inventory.read','reports.read','stores.read']
        ),
        (
          'Vendeur',
          'Sorties de stock et ventes',
          array['catalog.read','inventory.read','reports.read','sales.manage','sales.read']
        ),
        (
          'Lecture seule',
          'Consultation uniquement',
          array['catalog.read','inventory.read','reports.read','sales.read']
        )
    ) as t(name, description, permissions)
  loop
    select id into role_id
    from public.roles
    where tenant_id = p_tenant_id and name = template.name;

    if role_id is null then
      insert into public.roles (tenant_id, name, description, is_system)
      values (p_tenant_id, template.name, template.description, true)
      returning id into role_id;
    end if;

    insert into public.role_permissions (tenant_id, role_id, permission_code)
    select p_tenant_id, role_id, code from unnest(template.permissions) as code
    on conflict (role_id, permission_code) do nothing;
  end loop;
end;
$$;

revoke all on function public.ensure_tenant_roles(uuid) from public;
revoke all on function public.ensure_tenant_roles(uuid) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Invitations (personnes qui n'ont pas encore de compte)
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role_id uuid not null,
  full_name text,
  invited_by uuid references auth.users(id) on delete set null,
  token uuid not null default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  constraint tenant_invitations_email_valid check (
    email = lower(btrim(email)) and char_length(email) between 5 and 160 and position('@' in email) > 1
  ),
  constraint tenant_invitations_role_same_tenant foreign key (tenant_id, role_id)
    references public.roles(tenant_id, id) on delete cascade
);

create unique index if not exists tenant_invitations_pending_unique
  on public.tenant_invitations (tenant_id, lower(email))
  where status = 'pending';

create index if not exists tenant_invitations_email_idx
  on public.tenant_invitations (lower(email))
  where status = 'pending';

alter table public.tenant_invitations enable row level security;

drop policy if exists tenant_invitations_read on public.tenant_invitations;
create policy tenant_invitations_read on public.tenant_invitations
  for select to authenticated
  using (public.has_tenant_permission(tenant_id, 'members.read'));

-- ---------------------------------------------------------------------------
-- 3. Lecture de l'équipe
-- ---------------------------------------------------------------------------
create or replace function public.list_tenant_members(p_tenant_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  full_name text,
  email text,
  role_id uuid,
  role_name text,
  status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'Vous n’avez pas accès à cette entreprise.' using errcode = '42501';
  end if;

  return query
    select
      m.id as membership_id,
      m.user_id,
      coalesce(pr.full_name, split_part(coalesce(u.email, 'membre'), '@', 1)) as full_name,
      coalesce(u.email, '') as email,
      m.role_id,
      r.name as role_name,
      m.status,
      m.created_at
    from public.memberships m
    join public.roles r on r.id = m.role_id and r.tenant_id = m.tenant_id
    left join public.profiles pr on pr.id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.tenant_id = p_tenant_id
    order by (r.name = 'Propriétaire') desc, coalesce(pr.full_name, u.email, '');
end;
$$;

create or replace function public.list_tenant_roles(p_tenant_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  is_system boolean,
  permissions text[],
  member_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'Vous n’avez pas accès à cette entreprise.' using errcode = '42501';
  end if;

  perform public.ensure_tenant_roles(p_tenant_id);

  return query
    select
      r.id,
      r.name,
      coalesce(r.description, ''),
      r.is_system,
      coalesce(array_agg(rp.permission_code order by rp.permission_code) filter (where rp.permission_code is not null), array[]::text[]) as permissions,
      (select count(*)::integer from public.memberships m where m.role_id = r.id and m.status = 'active') as member_count
    from public.roles r
    left join public.role_permissions rp on rp.role_id = r.id
    where r.tenant_id = p_tenant_id
    group by r.id, r.name, r.description, r.is_system
    order by (r.name = 'Propriétaire') desc, r.name;
end;
$$;

create or replace function public.list_tenant_invitations(p_tenant_id uuid)
returns table (
  id uuid,
  email text,
  full_name text,
  role_id uuid,
  role_name text,
  status text,
  created_at timestamptz,
  expires_at timestamptz,
  token uuid
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_tenant_permission(p_tenant_id, 'members.read') then
    raise exception 'Vous n’avez pas accès à la liste des invitations.' using errcode = '42501';
  end if;

  return query
    select
      i.id,
      i.email,
      coalesce(i.full_name, ''),
      i.role_id,
      r.name,
      i.status,
      i.created_at,
      i.expires_at,
      i.token
    from public.tenant_invitations i
    join public.roles r on r.id = i.role_id and r.tenant_id = i.tenant_id
    where i.tenant_id = p_tenant_id and i.status = 'pending'
    order by i.created_at desc;
end;
$$;

revoke all on function public.list_tenant_members(uuid) from anon;
revoke all on function public.list_tenant_roles(uuid) from anon;
revoke all on function public.list_tenant_invitations(uuid) from anon;

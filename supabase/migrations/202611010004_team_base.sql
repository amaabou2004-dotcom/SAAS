-- 202611010004_team_base.sql
-- ---------------------------------------------------------------------------
-- Équipe : la base manquante du parcours d'invitation.
--
-- Ces objets existaient dans la base de développement mais **n'étaient pas
-- décrits par une migration** : une base neuve (CI, nouvel environnement) ne
-- pouvait donc pas créer d'invitation ni afficher les rôles. Ce fichier rend le
-- schéma reproductible, à l'identique de la base de référence :
--
--   1. la table `tenant_invitations` (e-mail invité, rôle prévu, jeton,
--      expiration à 14 jours) ;
--   2. `ensure_tenant_roles` : garantit les cinq rôles système et leurs
--      permissions dans une entreprise ;
--   3. les lectures (`list_tenant_members`, `list_tenant_roles`,
--      `list_tenant_invitations`) ;
--   4. les écritures (`invite_member`, `update_member_role`, `remove_member`),
--      toujours derrière `members.manage`, avec la règle « il reste toujours un
--      propriétaire ».
--
-- Tout est idempotent (`if not exists`, `create or replace`) : la migration
-- suivante (202611020005) peut alors modifier la table et ajouter
-- `revoke_invitation` / `accept_my_invitations`.
-- ---------------------------------------------------------------------------
begin;

-- 1. Invitations en attente.
create table if not exists public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role_id uuid not null,
  full_name text,
  invited_by uuid references auth.users(id) on delete set null,
  token uuid not null default gen_random_uuid(),
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'),
  constraint tenant_invitations_status_check
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  constraint tenant_invitations_email_valid
    check (
      email = lower(btrim(email))
      and char_length(email) between 5 and 160
      and position('@' in email) > 1
    ),
  constraint tenant_invitations_role_same_tenant
    foreign key (tenant_id, role_id) references public.roles(tenant_id, id) on delete cascade
);

create unique index if not exists tenant_invitations_pending_unique
  on public.tenant_invitations (tenant_id, lower(email))
  where (status = 'pending');

create index if not exists tenant_invitations_email_idx
  on public.tenant_invitations (lower(email))
  where (status = 'pending');

alter table public.tenant_invitations enable row level security;

drop policy if exists tenant_invitations_read on public.tenant_invitations;
create policy tenant_invitations_read on public.tenant_invitations
  for select to authenticated
  using (public.has_tenant_permission(tenant_id, 'members.read'));

-- Le client lit, les fonctions `security definer` écrivent.
revoke all on table public.tenant_invitations from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.tenant_invitations from authenticated;
grant select on table public.tenant_invitations to authenticated;

-- 2. Rôles système et permissions d'une entreprise.
create or replace function public.ensure_tenant_roles(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  template record;
  v_role_id uuid;
begin
  for template in
    select *
    from (
      values
        ('Propriétaire', 'Accès complet à l’entreprise', array['audit.read','catalog.manage','catalog.read','inventory.manage','inventory.read','members.manage','members.read','reports.manage','reports.read','sales.manage','sales.read','stores.manage','stores.read','tenant.manage','tenant.read']),
        ('Gestionnaire', 'Catalogue, stock, rapports et équipe', array['audit.read','catalog.manage','catalog.read','inventory.manage','inventory.read','members.read','reports.read','sales.read','stores.manage','stores.read','tenant.read']),
        ('Magasinier', 'Réception, sorties et inventaires', array['catalog.read','inventory.manage','inventory.read','reports.read','stores.read']),
        ('Vendeur', 'Sorties de stock et ventes', array['catalog.read','inventory.read','reports.read','sales.manage','sales.read']),
        ('Lecture seule', 'Consultation uniquement', array['catalog.read','inventory.read','reports.read','sales.read'])
    ) as t(role_name, role_description, role_permissions_list)
  loop
    select r.id into v_role_id from public.roles r where r.tenant_id = p_tenant_id and r.name = template.role_name;
    if v_role_id is null then
      insert into public.roles (tenant_id, name, description, is_system)
      values (p_tenant_id, template.role_name, template.role_description, true)
      returning id into v_role_id;
    end if;
    insert into public.role_permissions (tenant_id, role_id, permission_code)
    select p_tenant_id, v_role_id, perm.code from unnest(template.role_permissions_list) as perm(code)
    on conflict (role_id, permission_code) do nothing;
  end loop;
end;
$$;

-- 3. Lectures.
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
    select m.id, m.user_id,
           coalesce(pr.full_name::text, split_part(coalesce(u.email, 'membre'), '@', 1)::text),
           coalesce(u.email::text, ''::text),
           m.role_id, r.name::text, m.status::text, m.created_at
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
    select r.id, r.name, coalesce(r.description, ''), r.is_system,
           coalesce(array_agg(rp.permission_code order by rp.permission_code) filter (where rp.permission_code is not null), array[]::text[]),
           (select count(*)::integer from public.memberships m where m.role_id = r.id and m.status = 'active')
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
    select i.id, i.email::text, coalesce(i.full_name, '')::text, i.role_id, r.name::text, i.status::text, i.created_at, i.expires_at, i.token
    from public.tenant_invitations i
    join public.roles r on r.id = i.role_id and r.tenant_id = i.tenant_id
    where i.tenant_id = p_tenant_id and i.status = 'pending'
    order by i.created_at desc;
end;
$$;

-- 4. Écritures.
create or replace function public.invite_member(
  p_tenant_id uuid,
  p_email text,
  p_role_id uuid,
  p_full_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user_id uuid;
  v_membership_id uuid;
  v_invitation_id uuid;
  v_existing uuid;
begin
  if not public.has_tenant_permission(p_tenant_id, 'members.manage') then
    raise exception 'Seul un administrateur peut inviter des membres.' using errcode = '42501';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then
    raise exception 'Adresse e-mail invalide.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.roles where id = p_role_id and tenant_id = p_tenant_id) then
    raise exception 'Rôle inconnu pour cette entreprise.' using errcode = '22023';
  end if;

  -- La personne a déjà un compte : elle rejoint l'entreprise immédiatement.
  select id into v_user_id from auth.users where lower(email) = v_email limit 1;
  if v_user_id is not null then
    select m.id into v_existing from public.memberships m where m.tenant_id = p_tenant_id and m.user_id = v_user_id;
    if v_existing is not null then
      update public.memberships
        set role_id = p_role_id, status = 'active', updated_at = now()
        where id = v_existing
        returning id into v_membership_id;
    else
      insert into public.memberships (tenant_id, user_id, role_id, status)
      values (p_tenant_id, v_user_id, p_role_id, 'active')
      returning id into v_membership_id;
    end if;

    update public.tenant_invitations
      set status = 'accepted', accepted_at = now()
      where tenant_id = p_tenant_id and lower(email) = v_email and status = 'pending';

    return jsonb_build_object('status', 'added', 'user_id', v_user_id, 'membership_id', v_membership_id);
  end if;

  -- Sinon : invitation en attente, valable 14 jours.
  insert into public.tenant_invitations (tenant_id, email, role_id, full_name, invited_by)
  values (p_tenant_id, v_email, p_role_id, nullif(btrim(coalesce(p_full_name, '')), ''), auth.uid())
  on conflict (tenant_id, lower(email)) where status = 'pending'
  do update set
    role_id = excluded.role_id,
    full_name = coalesce(excluded.full_name, public.tenant_invitations.full_name),
    created_at = now(),
    expires_at = now() + interval '14 days'
  returning id into v_invitation_id;

  return jsonb_build_object('status', 'invited', 'invitation_id', v_invitation_id);
end;
$$;

create or replace function public.update_member_role(
  p_tenant_id uuid,
  p_membership_id uuid,
  p_role_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner_count integer;
  v_is_owner boolean;
  v_new_role text;
begin
  if not public.has_tenant_permission(p_tenant_id, 'members.manage') then
    raise exception 'Seul un administrateur peut modifier les rôles.' using errcode = '42501';
  end if;

  select name into v_new_role from public.roles where id = p_role_id and tenant_id = p_tenant_id;
  if v_new_role is null then
    raise exception 'Rôle inconnu pour cette entreprise.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.memberships where id = p_membership_id and tenant_id = p_tenant_id) then
    raise exception 'Membre introuvable.' using errcode = 'P0002';
  end if;

  select exists (
    select 1 from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.id = p_membership_id and m.tenant_id = p_tenant_id and r.name = 'Propriétaire'
  ) into v_is_owner;

  if v_is_owner and v_new_role <> 'Propriétaire' then
    select count(*) into v_owner_count
    from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.tenant_id = p_tenant_id and m.status = 'active' and r.name = 'Propriétaire';
    if v_owner_count <= 1 then
      raise exception 'Il doit rester au moins un propriétaire dans l’entreprise.' using errcode = '23514';
    end if;
  end if;

  update public.memberships
    set role_id = p_role_id, updated_at = now()
    where id = p_membership_id and tenant_id = p_tenant_id;
end;
$$;

create or replace function public.remove_member(p_tenant_id uuid, p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner_count integer;
  v_is_owner boolean;
begin
  if not public.has_tenant_permission(p_tenant_id, 'members.manage') then
    raise exception 'Seul un administrateur peut retirer un membre.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.memberships where id = p_membership_id and tenant_id = p_tenant_id) then
    raise exception 'Membre introuvable.' using errcode = 'P0002';
  end if;

  select exists (
    select 1 from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.id = p_membership_id and m.tenant_id = p_tenant_id and r.name = 'Propriétaire'
  ) into v_is_owner;

  if v_is_owner then
    select count(*) into v_owner_count
    from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.tenant_id = p_tenant_id and m.status = 'active' and r.name = 'Propriétaire';
    if v_owner_count <= 1 then
      raise exception 'Il doit rester au moins un propriétaire dans l’entreprise.' using errcode = '23514';
    end if;
  end if;

  delete from public.memberships where id = p_membership_id and tenant_id = p_tenant_id;
end;
$$;

-- 5. Droits d'exécution : le client seulement, jamais `anon`.
revoke all on function public.list_tenant_members(uuid) from public, anon;
revoke all on function public.list_tenant_roles(uuid) from public, anon;
revoke all on function public.list_tenant_invitations(uuid) from public, anon;
revoke all on function public.invite_member(uuid, text, uuid, text) from public, anon;
revoke all on function public.update_member_role(uuid, uuid, uuid) from public, anon;
revoke all on function public.remove_member(uuid, uuid) from public, anon;

grant execute on function public.list_tenant_members(uuid) to authenticated;
grant execute on function public.list_tenant_roles(uuid) to authenticated;
grant execute on function public.list_tenant_invitations(uuid) to authenticated;
grant execute on function public.invite_member(uuid, text, uuid, text) to authenticated;
grant execute on function public.update_member_role(uuid, uuid, uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

revoke all on function public.ensure_tenant_roles(uuid) from public, anon, authenticated;

commit;

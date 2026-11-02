-- Mutations d'équipe : inviter, accepter, changer de rôle, retirer un membre.

-- ---------------------------------------------------------------------------
-- 1. Inviter une personne (l'ajoute directement si elle a déjà un compte)
-- ---------------------------------------------------------------------------
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

  select id into v_user_id from auth.users where lower(email) = v_email limit 1;

  if v_user_id is not null then
    select m.id into v_existing
    from public.memberships m
    where m.tenant_id = p_tenant_id and m.user_id = v_user_id;

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

    return jsonb_build_object(
      'status', 'added',
      'user_id', v_user_id,
      'membership_id', v_membership_id
    );
  end if;

  insert into public.tenant_invitations (tenant_id, email, role_id, full_name, invited_by)
  values (
    p_tenant_id,
    v_email,
    p_role_id,
    nullif(btrim(coalesce(p_full_name, '')), ''),
    auth.uid()
  )
  on conflict (tenant_id, lower(email)) where status = 'pending'
  do update set role_id = excluded.role_id,
                full_name = coalesce(excluded.full_name, public.tenant_invitations.full_name),
                created_at = now(),
                expires_at = now() + interval '14 days'
  returning id into v_invitation_id;

  return jsonb_build_object('status', 'invited', 'invitation_id', v_invitation_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Annuler une invitation en attente
-- ---------------------------------------------------------------------------
create or replace function public.revoke_invitation(p_tenant_id uuid, p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_tenant_permission(p_tenant_id, 'members.manage') then
    raise exception 'Seul un administrateur peut annuler une invitation.' using errcode = '42501';
  end if;

  update public.tenant_invitations
     set status = 'revoked'
   where id = p_invitation_id and tenant_id = p_tenant_id and status = 'pending';

  if not found then
    raise exception 'Invitation introuvable ou déjà traitée.' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Accepter les invitations correspondant à mon adresse e-mail
-- ---------------------------------------------------------------------------
create or replace function public.accept_invitations()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_count integer := 0;
  invitation record;
begin
  if v_uid is null then
    return 0;
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  if v_email is null then
    return 0;
  end if;

  for invitation in
    select i.*
    from public.tenant_invitations i
    where lower(i.email) = v_email
      and i.status = 'pending'
      and i.expires_at > now()
  loop
    insert into public.memberships (tenant_id, user_id, role_id, status)
    values (invitation.tenant_id, v_uid, invitation.role_id, 'active')
    on conflict (tenant_id, user_id) do update
      set role_id = excluded.role_id, status = 'active', updated_at = now();

    update public.tenant_invitations
       set status = 'accepted', accepted_at = now()
     where id = invitation.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Changer le rôle d'un membre
-- ---------------------------------------------------------------------------
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

  select exists (
    select 1
    from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.id = p_membership_id and m.tenant_id = p_tenant_id and r.name = 'Propriétaire'
  ) into v_is_owner;

  if not exists (select 1 from public.memberships where id = p_membership_id and tenant_id = p_tenant_id) then
    raise exception 'Membre introuvable.' using errcode = 'P0002';
  end if;

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

-- ---------------------------------------------------------------------------
-- 5. Retirer un membre
-- ---------------------------------------------------------------------------
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

  select exists (
    select 1
    from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.id = p_membership_id and m.tenant_id = p_tenant_id and r.name = 'Propriétaire'
  ) into v_is_owner;

  if not exists (select 1 from public.memberships where id = p_membership_id and tenant_id = p_tenant_id) then
    raise exception 'Membre introuvable.' using errcode = 'P0002';
  end if;

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

revoke all on function public.invite_member(uuid, text, uuid, text) from anon;
revoke all on function public.revoke_invitation(uuid, uuid) from anon;
revoke all on function public.accept_invitations() from anon;
revoke all on function public.update_member_role(uuid, uuid, uuid) from anon;
revoke all on function public.remove_member(uuid, uuid) from anon;

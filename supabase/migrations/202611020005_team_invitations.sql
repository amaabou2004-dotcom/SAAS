-- 202611020005_team_invitations.sql
-- ---------------------------------------------------------------------------
-- Équipe : invitations et adhésions.
--
-- Les tables (`memberships`, `roles`, `tenant_invitations`) et les fonctions
-- `invite_member`, `update_member_role`, `remove_member`, `list_tenant_members`
-- et `list_tenant_roles` existaient déjà. Ce qui manquait pour que le parcours
-- soit complet :
--
--   1. `revoke_invitation` : annuler une invitation (members.manage) — la
--      lecture, elle, passait déjà par `list_tenant_invitations` ;
--   2. `accept_my_invitations` : à la connexion, transformer les invitations
--      envoyées à l'adresse de l'utilisateur en adhésions réelles — c'est ce qui
--      permet d'inviter quelqu'un qui n'a pas encore de compte ;
--   3. un statut `expired` (aujourd'hui la contrainte n'autorisait que
--      pending / accepted / revoked) ;
--   4. le durcissement des droits : `anon` n'a besoin de rien, et le client ne
--      doit jamais écrire directement dans `tenant_invitations` (tout passe par
--      les fonctions `security definer` qui vérifient `members.manage`).
-- ---------------------------------------------------------------------------
begin;

-- 1. Statut `expired` autorisé.
alter table public.tenant_invitations
  drop constraint if exists tenant_invitations_status_check;
alter table public.tenant_invitations
  add constraint tenant_invitations_status_check
  check (status in ('pending', 'accepted', 'revoked', 'expired'));

-- 2. Voir les invitations en attente : `list_tenant_invitations` existe déjà
-- (id, email, full_name, role_id, role_name, status, created_at, expires_at,
-- token) et exige `members.read`. Rien à ajouter.

-- 3. Annuler une invitation en attente.
create or replace function public.revoke_invitation(p_tenant_id uuid, p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
begin
  if not public.has_tenant_permission(p_tenant_id, 'members.manage') then
    raise exception 'Seul un administrateur peut annuler une invitation.' using errcode = '42501';
  end if;

  select lower(email) into v_email
  from public.tenant_invitations
  where id = p_invitation_id and tenant_id = p_tenant_id and status = 'pending';

  if v_email is null then
    raise exception 'Invitation introuvable ou déjà traitée.' using errcode = 'P0002';
  end if;

  -- Une personne invitée qui possède déjà un compte est ajoutée directement par
  -- `invite_member` : dans ce cas, il n'y a plus d'invitation à annuler.
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Cette personne a déjà un compte : modifiez son rôle dans la liste des membres.' using errcode = '23514';
  end if;

  update public.tenant_invitations
  set status = 'revoked'
  where id = p_invitation_id and tenant_id = p_tenant_id and status = 'pending';
end;
$$;

-- 4. Accepter les invitations de sa propre adresse (appelée à la connexion).
create or replace function public.accept_my_invitations()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_count integer := 0;
  invitation record;
begin
  if v_user_id is null then
    raise exception 'Session requise.' using errcode = '42501';
  end if;

  select lower(email) into v_email from auth.users where id = v_user_id;
  if v_email is null then
    return jsonb_build_object('accepted', 0);
  end if;

  for invitation in
    select candidate.id, candidate.tenant_id, candidate.role_id
    from public.tenant_invitations as candidate
    where lower(candidate.email) = v_email
      and candidate.status = 'pending'
      and candidate.expires_at > now()
    order by candidate.created_at
  loop
    insert into public.memberships (tenant_id, user_id, role_id, status)
    values (invitation.tenant_id, v_user_id, invitation.role_id, 'active')
    on conflict on constraint memberships_tenant_user_unique do update
      set role_id = excluded.role_id,
          status = 'active',
          updated_at = now()
      where public.memberships.status <> 'active';

    update public.tenant_invitations
    set status = 'accepted', accepted_at = now()
    where id = invitation.id;

    v_count := v_count + 1;
  end loop;

  -- Les invitations dépassées ne doivent plus apparaître comme en attente.
  update public.tenant_invitations
  set status = 'expired'
  where lower(email) = v_email
    and status = 'pending'
    and expires_at <= now();

  return jsonb_build_object('accepted', v_count);
end;
$$;

-- 5. Droits : le client lit, les fonctions écrivent.
revoke all on table public.tenant_invitations from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.tenant_invitations from authenticated;
grant select on table public.tenant_invitations to authenticated;

revoke all on function public.invite_member(uuid, text, uuid, text) from public, anon;
revoke all on function public.update_member_role(uuid, uuid, uuid) from public, anon;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
revoke all on function public.list_tenant_members(uuid) from public, anon;
revoke all on function public.list_tenant_roles(uuid) from public, anon;
revoke all on function public.revoke_invitation(uuid, uuid) from public, anon;
revoke all on function public.accept_my_invitations() from public, anon;

grant execute on function public.invite_member(uuid, text, uuid, text) to authenticated;
grant execute on function public.update_member_role(uuid, uuid, uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.list_tenant_members(uuid) to authenticated;
grant execute on function public.list_tenant_roles(uuid) to authenticated;
grant execute on function public.revoke_invitation(uuid, uuid) to authenticated;
grant execute on function public.accept_my_invitations() to authenticated;

commit;

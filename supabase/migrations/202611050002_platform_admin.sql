-- 202611050002_platform_admin.sql
-- ---------------------------------------------------------------------------
-- Administration de la plateforme : un compte « éditeur » voit les comptes,
-- les entreprises et leurs chiffres, sans casser l'isolation des données.
--
-- 1. L'adresse de l'éditeur (amaabou2004@gmail.com) devient administratrice
--    automatiquement, y compris si le compte est créé plus tard.
-- 2. `platform_overview()` renvoie, pour un administrateur seulement :
--      * les totaux de la plateforme (comptes, entreprises, ventes) ;
--      * la liste des comptes (e-mail, nom, dates, entreprises et rôles) ;
--      * la liste des entreprises (membres, produits, ventes, chiffre
--        d'affaires, premier inscrit).
--
-- Ce que cette migration NE fait PAS, volontairement : ouvrir en lecture les
-- lignes métier des entreprises clientes (ventes, clients, stocks détaillés).
-- L'isolation par entreprise reste intacte ; l'administration voit des
-- agrégats et des comptes, jamais le détail commercial d'un commerçant.
-- ---------------------------------------------------------------------------
begin;

-- 1. Nomination automatique de l'éditeur -----------------------------------
create or replace function public.grant_platform_admin_to_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null and lower(new.email) = 'amaabou2004@gmail.com' then
    insert into public.platform_admins (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists grant_platform_admin_to_owner on auth.users;
create trigger grant_platform_admin_to_owner
after insert or update of email on auth.users
for each row execute function public.grant_platform_admin_to_owner();

-- Compte éventuellement déjà créé avant cette migration.
insert into public.platform_admins (user_id)
select id
from auth.users
where lower(email) = 'amaabou2004@gmail.com'
on conflict (user_id) do nothing;

-- 2. Vue d'ensemble de la plateforme ---------------------------------------
create or replace function public.platform_overview(p_search text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_search text := nullif(lower(btrim(coalesce(p_search, ''))), '');
begin
  if not public.is_platform_admin() then
    raise exception 'Ces informations sont réservées à l’administration de la plateforme.'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'totals', jsonb_build_object(
      'users', (select count(*)::integer from auth.users),
      'confirmed', (select count(*)::integer from auth.users where email_confirmed_at is not null),
      'tenants', (select count(*)::integer from public.tenants),
      'admins', (select count(*)::integer from public.platform_admins),
      'sales', (select count(*)::integer from public.sales where status = 'completed')
    ),
    'users', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', listed.id,
            'email', listed.email,
            'full_name', listed.full_name,
            'created_at', listed.created_at,
            'email_confirmed_at', listed.email_confirmed_at,
            'last_sign_in_at', listed.last_sign_in_at,
            'is_admin', listed.is_admin,
            'companies', listed.companies
          )
          order by listed.created_at desc
        ),
        '[]'::jsonb
      )
      from (
        select
          account.id,
          account.email,
          profile.full_name,
          account.created_at,
          account.email_confirmed_at,
          account.last_sign_in_at,
          exists (
            select 1 from public.platform_admins as admin where admin.user_id = account.id
          ) as is_admin,
          coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'name', membership_tenant.name,
                  'role', membership_role.name,
                  'status', membership.status
                )
                order by membership_tenant.name
              )
              from public.memberships as membership
              join public.tenants as membership_tenant on membership_tenant.id = membership.tenant_id
              join public.roles as membership_role on membership_role.id = membership.role_id
              where membership.user_id = account.id
            ),
            '[]'::jsonb
          ) as companies
        from auth.users as account
        left join public.profiles as profile on profile.id = account.id
        where v_search is null
          or lower(coalesce(account.email, '')) like '%' || v_search || '%'
          or lower(coalesce(profile.full_name, '')) like '%' || v_search || '%'
        order by account.created_at desc
        limit 200
      ) as listed
    ),
    'tenants', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', shop.id,
            'name', shop.name,
            'slug', shop.slug,
            'status', shop.status,
            'currency_code', shop.currency_code,
            'created_at', shop.created_at,
            'members', (
              select count(*)::integer from public.memberships as membership
              where membership.tenant_id = shop.id and membership.status = 'active'
            ),
            'products', (
              select count(*)::integer from public.products as product
              where product.tenant_id = shop.id and product.active
            ),
            'sales', (
              select count(*)::integer from public.sales as sale
              where sale.tenant_id = shop.id and sale.status = 'completed'
            ),
            'revenue', (
              select coalesce(sum(sale.total), 0)
              from public.sales as sale
              where sale.tenant_id = shop.id and sale.status = 'completed'
            ),
            'first_member_email', (
              select account.email
              from public.memberships as membership
              join auth.users as account on account.id = membership.user_id
              where membership.tenant_id = shop.id
              order by membership.created_at, membership.id
              limit 1
            )
          )
          order by shop.created_at desc
        ),
        '[]'::jsonb
      )
      from (
        select *
        from public.tenants
        where v_search is null
          or lower(name) like '%' || v_search || '%'
          or lower(slug) like '%' || v_search || '%'
        order by created_at desc
        limit 200
      ) as shop
    )
  );
end;
$$;

-- 3. Droits ---------------------------------------------------------------
-- Aucun droit direct sur les tables : tout passe par les fonctions ci-dessus.
revoke all on function public.grant_platform_admin_to_owner() from public, anon, authenticated;

revoke all on function public.platform_overview(text) from public, anon;
grant execute on function public.platform_overview(text) to authenticated;

commit;

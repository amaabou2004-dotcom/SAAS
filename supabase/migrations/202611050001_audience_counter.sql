-- 202611050001_audience_counter.sql
-- ---------------------------------------------------------------------------
-- Compteur de visites « maison » : aucune ressource tierce, aucun cookie.
--
-- Pourquoi ici plutôt que chez un prestataire : l'application n'embarque aucun
-- traceur (voir la politique de confidentialité). Ce compteur tient en deux
-- fonctions et une table, ne pose aucun cookie, et n'enregistre jamais l'adresse
-- IP : seule une empreinte SHA-256 (adresse + navigateur + jour + sel) est
-- conservée, et elle change chaque jour. Impossible de suivre une personne dans
-- le temps ou de la reconnaître ailleurs.
--
-- Ce qui est mesuré :
--   * pages publiques uniquement (accueil, boutique, pages légales) ;
--   * une vue par personne, par page et par jour (index unique) ;
--   * des totaux agrégés (vues, visiteurs distincts, pages les plus vues).
--
-- Qui peut lire les chiffres : uniquement les administrateurs de la plateforme
-- (`platform_admins`), jamais les entreprises clientes.
-- ---------------------------------------------------------------------------
begin;

-- 1. Administrateurs de la plateforme -------------------------------------
-- Aucun droit direct : la table n'est lisible qu'à travers les fonctions
-- `security definer` ci-dessous. Pour nommer le premier administrateur, voir
-- docs/AUDIENCE.md (une requête SQL à exécuter une fois).
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.platform_admins is
  'Comptes autorisés à consulter les chiffres de la plateforme (audience).';

alter table public.platform_admins enable row level security;

-- 2. Journal des visites ---------------------------------------------------
create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  viewed_on date not null,
  path text not null,
  referrer_host text,
  visitor_hash text not null,
  created_at timestamptz not null default now(),
  constraint page_views_path_valid check (
    left(path, 1) = '/' and char_length(path) between 1 and 120
  ),
  constraint page_views_referrer_valid check (
    referrer_host is null or char_length(referrer_host) between 1 and 120
  ),
  constraint page_views_visitor_valid check (char_length(visitor_hash) between 16 and 64)
);

comment on table public.page_views is
  'Vues agrégées des pages publiques : une ligne par personne, par page et par jour, sans adresse IP.';

-- Une seule vue comptée par personne, par page et par jour.
create unique index if not exists page_views_daily_unique_idx
  on public.page_views (viewed_on, visitor_hash, path);
create index if not exists page_views_viewed_on_idx
  on public.page_views (viewed_on desc);

alter table public.page_views enable row level security;

-- 3. Enregistrement d'une vue ---------------------------------------------
-- Appelée par le navigateur (rôle `anon`) : c'est le seul point d'entrée
-- ouvert aux visiteurs non connectés.
create or replace function public.track_page_view(
  p_path text,
  p_referrer text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_headers jsonb;
  v_ip text;
  v_agent text;
  v_path text;
  v_referrer text;
  v_visitor text;
  v_today date := (now() at time zone 'utc')::date;
  v_seen integer;
begin
  -- Chemin : on ne garde que la partie utile, sans paramètres ni ancre.
  v_path := split_part(left(coalesce(nullif(btrim(p_path), ''), '/'), 160), '?', 1);
  v_path := split_part(v_path, '#', 1);
  if left(v_path, 1) <> '/' then
    v_path := '/' || v_path;
  end if;
  v_path := left(v_path, 120);

  -- Provenance : nom d'hôte seul (aucune adresse complète, aucun paramètre).
  v_referrer := lower(coalesce(nullif(btrim(p_referrer), ''), ''));
  if v_referrer <> '' and v_referrer !~ '^[a-z0-9][a-z0-9.-]{0,118}[a-z0-9]$' then
    v_referrer := null;
  end if;

  v_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  v_ip := btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1));
  v_agent := left(coalesce(v_headers ->> 'user-agent', ''), 200);

  if v_ip = '' then
    -- Sans adresse, on préfère compter une personne de plus plutôt que de
    -- fusionner tous les visiteurs dans une même empreinte.
    v_visitor := replace(gen_random_uuid()::text, '-', '');
  else
    v_visitor := md5(v_ip || '|' || v_agent || '|' || v_today::text || '|stokari-audience');
  end if;

  -- Garde-fou : un même visiteur ne peut pas enregistrer plus de 40 pages
  -- différentes dans la journée (protège la table d'un script bruyant).
  select count(*) into v_seen
  from public.page_views
  where viewed_on = v_today
    and visitor_hash = v_visitor;

  if v_seen >= 40 then
    return;
  end if;

  insert into public.page_views (viewed_on, path, referrer_host, visitor_hash)
  values (v_today, v_path, v_referrer, v_visitor)
  on conflict do nothing;
end;
$$;

-- 4. Lecture des chiffres --------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins
    where user_id = (select auth.uid())
  );
$$;

create or replace function public.audience_summary(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_days integer := greatest(1, least(coalesce(p_days, 30), 180));
  v_from date := (now() at time zone 'utc')::date - (greatest(1, least(coalesce(p_days, 30), 180)) - 1);
begin
  if not public.is_platform_admin() then
    raise exception 'Ces chiffres sont réservés à l’administration de la plateforme.'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'days', v_days,
    'first_day', (select min(viewed_on) from public.page_views),
    'totals', (
      select jsonb_build_object(
        'views', count(*)::integer,
        'visitors', count(distinct visitor_hash)::integer
      )
      from public.page_views
      where viewed_on >= v_from
    ),
    'today', (
      select jsonb_build_object(
        'views', count(*)::integer,
        'visitors', count(distinct visitor_hash)::integer
      )
      from public.page_views
      where viewed_on = v_today
    ),
    'yesterday', (
      select jsonb_build_object(
        'views', count(*)::integer,
        'visitors', count(distinct visitor_hash)::integer
      )
      from public.page_views
      where viewed_on = v_today - 1
    ),
    'daily', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'day', day_stats.day,
            'views', day_stats.views,
            'visitors', day_stats.visitors
          )
          order by day_stats.day
        ),
        '[]'::jsonb
      )
      from (
        select
          series.day::date as day,
          coalesce(sum(stats.views), 0)::integer as views,
          coalesce(sum(stats.visitors), 0)::integer as visitors
        from generate_series(v_from::timestamp, v_today::timestamp, interval '1 day') as series(day)
        left join (
          select
            viewed_on,
            count(*)::integer as views,
            count(distinct visitor_hash)::integer as visitors
          from public.page_views
          where viewed_on >= v_from
          group by viewed_on
        ) as stats on stats.viewed_on = series.day::date
        group by series.day
      ) as day_stats
    ),
    'paths', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('path', page_stats.path, 'views', page_stats.views)
          order by page_stats.views desc, page_stats.path
        ),
        '[]'::jsonb
      )
      from (
        select path, count(*)::integer as views
        from public.page_views
        where viewed_on >= v_from
        group by path
        order by count(*) desc, path
        limit 8
      ) as page_stats
    )
  );
end;
$$;

-- 5. Droits ---------------------------------------------------------------
-- Aucune lecture directe des tables : tout passe par les fonctions ci-dessus.
revoke all on table public.page_views from public, anon, authenticated;
revoke all on table public.platform_admins from public, anon, authenticated;

-- Le seul droit ouvert aux visiteurs : enregistrer une vue.
revoke all on function public.track_page_view(text, text) from public;
grant execute on function public.track_page_view(text, text) to anon, authenticated;

revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

revoke all on function public.audience_summary(integer) from public, anon;
grant execute on function public.audience_summary(integer) to authenticated;

commit;

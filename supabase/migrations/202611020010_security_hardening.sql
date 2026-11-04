-- =============================================================================
-- Audit de sécurité (novembre 2026) — durcissement des droits
-- =============================================================================
-- Objectif : le rôle « anon » (visiteur non connecté, clé publique) ne doit
-- pouvoir appeler QUE les trois fonctions de la boutique publique.
-- Toutes les autres RPC sont réservées aux utilisateurs connectés
-- (« authenticated ») ou au service interne (cron / rôle service_role).
--
-- Note : les fonctions concernées vérifient déjà `auth.uid()` et
-- `has_tenant_permission(...)` dans leur corps. Le nettoyage des GRANT est une
-- défense en profondeur : même en cas de future erreur de développement, un
-- visiteur anonyme ne pourra pas tenter l'appel.
--
-- Les révocations sont exécutées par une boucle : elles n'échouent pas si une
-- fonction n'existe pas dans l'environnement (le projet hébergé possède par
-- exemple `rls_auto_enable`, absent de Supabase local).
-- =============================================================================

do $$
declare
  signature text;
begin
  -- 1. Rôle « anon » (et PUBLIC) : tout est fermé sauf la boutique publique.
  for signature in
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      -- on ne touche jamais aux fonctions apportées par une extension
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and p.proname not in ('storefront_catalog', 'storefront_info', 'place_storefront_order')
  loop
    execute format('revoke all on function %s from public, anon', signature);
  end loop;

  -- 2. Fonctions internes : même un utilisateur connecté ne doit pas les appeler.
  --    - utilitaires et déclencheurs ;
  --    - pipeline e-mail des commandes (cron / service) ;
  --    - générateurs de données de démonstration (aucune donnée factice injectable).
  for signature in
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and p.proname in (
        'rls_auto_enable',
        'set_updated_at',
        'handle_new_user',
        'create_default_stock_location',
        'queue_storefront_order_notification',
        'ensure_tenant_roles',
        'dispatch_notifications',
        'sync_notification_status',
        'order_notification_body',
        'seed_demo_data',
        'seed_demo_history'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
  end loop;
end $$;

-- 3. Par défaut : toute NOUVELLE fonction du schéma public ne reçoit plus
--    automatiquement le droit d'exécution pour « anon ».
--    (la boutique publique accorde explicitement son droit à ses 3 fonctions)
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres in schema public grant execute on functions to authenticated;
alter default privileges for role postgres in schema public grant execute on functions to service_role;

-- 4. Droits de table : correction d'un ancien « GRANT ALL »
--    `suppliers` : table héritée (aucun écran ne l'utilise) présente uniquement
--    sur le projet hébergé ; le client ne doit que LIRE.
--    `sales_overview` (vue de rapports) : lecture seule.
--    Les deux blocs sont conditionnels pour rester valables sur Supabase local.
do $$
begin
  if to_regclass('public.suppliers') is not null then
    execute 'revoke all on table public.suppliers from anon, authenticated';
    execute 'grant select on table public.suppliers to authenticated';
  end if;

  if to_regclass('public.sales_overview') is not null then
    execute 'revoke all on table public.sales_overview from anon, authenticated';
    execute 'grant select on table public.sales_overview to authenticated';
  end if;
end $$;

-- 5. Une nouvelle table du schéma public ne sera plus lisible ni modifiable
--    automatiquement par « anon » (les tables publiques doivent l'accorder
--    explicitement, et la RLS reste la deuxième barrière).
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- 6. Index manquant repéré pendant l'audit (liste des notifications par société)
create index if not exists notification_outbox_tenant_idx
  on public.notification_outbox (tenant_id, created_at desc);

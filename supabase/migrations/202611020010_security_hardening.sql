-- =============================================================================
-- Audit de sécurité (novembre 2026) — durcissement des droits
-- =============================================================================
-- Objectif : le rôle « anon » (visiteur non connecté, clé publique) ne doit
-- pouvoir appeler QUE les trois fonctions de la boutique publique.
-- Toutes les autres RPC sont réservées aux utilisateurs connectés
-- (« authenticated ») ou au service interne (cron / rôle service_role).
--
-- Note : les fonctions ci-dessous vérifient déjà `auth.uid()` et
-- `has_tenant_permission(...)` dans leur corps. Le nettoyage des GRANT est une
-- défense en profondeur : même en cas de future erreur de développement, un
-- visiteur anonyme ne pourra pas tenter l'appel.
-- =============================================================================

-- 1. Fonctions utilitaires et déclencheurs : aucun client ne doit les appeler
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.create_default_stock_location() from public, anon, authenticated;
revoke all on function public.queue_storefront_order_notification() from public, anon, authenticated;
revoke all on function public.ensure_tenant_roles(uuid) from public, anon, authenticated;

-- 2. Pipeline e-mail des commandes : réservé au cron / au service
--    (aucun client ne doit pouvoir déclencher un envoi ni lire un corps de mail)
revoke all on function public.dispatch_notifications(integer) from public, anon, authenticated;
revoke all on function public.sync_notification_status(integer) from public, anon, authenticated;
revoke all on function public.order_notification_body(uuid) from public, anon, authenticated;

-- 3. Générateurs de données de démonstration : service uniquement
--    (aucune donnée commerciale factice ne doit pouvoir être injectée par un client)
revoke all on function public.seed_demo_data(uuid) from public, anon, authenticated;
revoke all on function public.seed_demo_history(uuid, integer) from public, anon, authenticated;

-- 4. RPC métier : retrait du rôle anon (les contrôles internes restent en place)
revoke all on function public.create_tenant(text, text, text, text) from public, anon;
revoke all on function public.update_tenant_settings(uuid, text, text, text, text, text) from public, anon;

revoke all on function public.upsert_product(uuid, uuid, uuid, uuid, text, text, numeric, numeric, text, text, jsonb, boolean, text) from public, anon;
revoke all on function public.delete_product(uuid, uuid) from public, anon;
revoke all on function public.upsert_category(uuid, uuid, text, boolean) from public, anon;
revoke all on function public.upsert_stock_location(uuid, uuid, text, text, boolean) from public, anon;

revoke all on function public.save_supplier(uuid, uuid, text, text, text, text, text, integer, text, boolean) from public, anon;
revoke all on function public.delete_supplier(uuid, uuid) from public, anon;

revoke all on function public.post_stock_operation(uuid, text, text, text, text, jsonb, uuid) from public, anon;

revoke all on function public.accept_invitations() from public, anon;
revoke all on function public.has_tenant_permission(uuid, text) from public, anon;
revoke all on function public.is_tenant_member(uuid) from public, anon;

revoke all on function public.notification_settings_get(uuid) from public, anon;
revoke all on function public.notification_settings_save(uuid, text, boolean) from public, anon;
revoke all on function public.notifications_list(uuid, integer) from public, anon;

-- 5. Par défaut : toute NOUVELLE fonction du schéma public ne reçoit plus
--    automatiquement le droit d'exécution pour « anon ».
--    (la boutique publique accorde explicitement son droit à ses 3 fonctions)
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres in schema public grant execute on functions to authenticated;
alter default privileges for role postgres in schema public grant execute on functions to service_role;

-- 6. Droits de table : correction d'un ancien « GRANT ALL »
--    `suppliers` : le client ne fait que LIRE (écriture via save_supplier/delete_supplier)
revoke all on table public.suppliers from anon, authenticated;
grant select on table public.suppliers to authenticated;

--    `sales_overview` (vue de rapports) : lecture seule
revoke all on table public.sales_overview from anon, authenticated;
grant select on table public.sales_overview to authenticated;

--    Une nouvelle table du schéma public ne sera plus lisible ni modifiable
--    automatiquement par « anon » (les tables publiques doivent l'accorder
--    explicitement, et la RLS reste la deuxième barrière).
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- 7. Index manquant repéré pendant l'audit (liste des notifications par société)
create index if not exists notification_outbox_tenant_idx
  on public.notification_outbox (tenant_id, created_at desc);

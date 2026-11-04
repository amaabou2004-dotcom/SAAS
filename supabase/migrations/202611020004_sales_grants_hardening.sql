-- 202611020004_sales_grants_hardening.sql
-- ---------------------------------------------------------------------------
-- Durcissement des droits sur les ventes.
--
-- Supabase accorde par défaut tous les privilèges (insert/update/delete/…)
-- aux rôles `anon` et `authenticated` sur les nouvelles tables du schéma
-- `public`. La RLS bloquait déjà les écritures (aucune politique d'écriture),
-- mais on ne veut pas dépendre uniquement de la RLS :
--   * les ventes ne s'écrivent QUE via `post_sale` / `void_sale`
--     (fonctions `security definer`, qui vérifient `sales.manage`) ;
--   * le client ne lit que ce que la RLS `sales.read` / `sales.manage` autorise ;
--   * `anon` n'a aucun accès.
-- ---------------------------------------------------------------------------
begin;

revoke all on table public.sales from anon;
revoke all on table public.sale_items from anon;
revoke all on table public.sales_overview from anon;

revoke insert, update, delete, truncate, references, trigger
  on table public.sales, public.sale_items from authenticated;
revoke insert, update, delete, truncate
  on table public.sales_overview from authenticated;

grant select on table public.sales, public.sale_items to authenticated;
grant select on table public.sales_overview to authenticated;

commit;

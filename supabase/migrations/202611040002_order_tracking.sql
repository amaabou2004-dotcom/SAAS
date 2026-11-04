-- 202611040002_order_tracking.sql
-- ---------------------------------------------------------------------------
-- Suivi de commande par le client, sans compte.
--
-- Le client saisit le numéro reçu à la commande (CMD-000123) sur la page
-- publique. La fonction renvoie uniquement l'état de la commande : statut,
-- dates, nombre d'articles, total. Aucun nom, aucun téléphone, aucun détail
-- interne ne sort. Une commande d'une autre boutique est introuvable.
-- ---------------------------------------------------------------------------
begin;

create or replace function public.storefront_order_track(p_slug text, p_number text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.storefront_settings;
  v_tenant public.tenants;
  v_order public.storefront_orders;
  v_reference text := upper(btrim(coalesce(p_number, '')));
  v_seq bigint;
begin
  select * into v_settings from public.storefront_settings where slug = lower(btrim(coalesce(p_slug, '')));
  if not found then
    return null;
  end if;

  select * into v_tenant from public.tenants where id = v_settings.tenant_id;
  if not found or v_tenant.status <> 'active' then
    return null;
  end if;

  if v_reference !~ '^CMD-[0-9]{1,9}$' then
    return null;
  end if;
  v_seq := substring(v_reference from 5)::bigint;

  select * into v_order
  from public.storefront_orders
  where tenant_id = v_settings.tenant_id and seq = v_seq
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'number', 'CMD-' || lpad(v_order.seq::text, 6, '0'),
    'status', v_order.status,
    'item_count', v_order.item_count,
    'total', v_order.total,
    'currency_code', v_tenant.currency_code,
    'shop_name', coalesce(nullif(btrim(coalesce(v_settings.display_name, '')), ''), v_tenant.name),
    'created_at', v_order.created_at,
    'confirmed_at', v_order.confirmed_at,
    'delivered_at', v_order.delivered_at,
    'cancelled_at', v_order.cancelled_at,
    'cancel_reason', v_order.cancel_reason
  );
end;
$$;

revoke all on function public.storefront_order_track(text, text) from public;
grant execute on function public.storefront_order_track(text, text) to anon, authenticated;

commit;

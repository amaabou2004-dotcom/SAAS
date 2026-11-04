-- 202611020006_reports_summary.sql
-- ---------------------------------------------------------------------------
-- Rapports : un seul point d'entrée, `report_summary(tenant, du, au)`.
--
-- Pourquoi une fonction et pas une vue : le rapport croise plusieurs tables
-- (ventes, lignes de vente, produits, stock) avec des agrégats et des fenêtres
-- de dates calculées dans le fuseau de l'entreprise. Une fonction `security
-- definer` garantit une seule réponse cohérente, une seule vérification de
-- droit (`reports.read`) et un aller-retour réseau.
--
-- Le JSON renvoyé contient :
--   totals          ventes, CA, coût, marge, articles, panier moyen
--   today           les mêmes chiffres pour aujourd'hui (fuseau de l'entreprise)
--   daily           une ligne par jour, jours sans vente inclus
--   top_products    les 10 produits qui rapportent le plus
--   top_categories  les 5 catégories qui rapportent le plus
--   dormant         produits en stock jamais vendus depuis 30 jours
--   stock_value     capital immobilisé (quantité × prix d'achat)
--   product_count   produits actifs
--
-- Les ventes annulées sont exclues partout : elles ne comptent ni en CA ni en
-- marge, et le stock revient déjà à l'emplacement.
-- ---------------------------------------------------------------------------
begin;

create or replace function public.report_summary(
  p_tenant_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_timezone text;
  v_today date;
  v_totals jsonb;
  v_today_stats jsonb;
  v_daily jsonb;
  v_top_products jsonb;
  v_top_categories jsonb;
  v_dormant jsonb;
  v_stock_value numeric;
  v_product_count integer;
begin
  if not (
    public.has_tenant_permission(p_tenant_id, 'reports.read')
    or public.has_tenant_permission(p_tenant_id, 'reports.manage')
  ) then
    raise exception 'Vous n’avez pas accès aux rapports de cette entreprise.' using errcode = '42501';
  end if;

  if p_from is null or p_to is null then
    raise exception 'Période incomplète.' using errcode = '22023';
  end if;
  if p_from > p_to then
    raise exception 'La date de début doit précéder la date de fin.' using errcode = '22023';
  end if;
  if p_to - p_from > 400 then
    raise exception 'La période ne peut pas dépasser 400 jours.' using errcode = '22023';
  end if;

  select coalesce(timezone, 'Africa/Niamey') into v_timezone
  from public.tenants where id = p_tenant_id;

  if v_timezone is null then
    raise exception 'Entreprise inconnue.' using errcode = '42501';
  end if;

  v_today := (now() at time zone v_timezone)::date;

  -- Totaux de la période.
  select jsonb_build_object(
    'sales', count(*),
    'revenue', round(coalesce(sum(s.total), 0), 4),
    'cost', round(coalesce(sum(s.total_cost), 0), 4),
    'margin', round(coalesce(sum(s.total - s.total_cost), 0), 4),
    'items', coalesce(sum(s.item_count), 0),
    'average_basket', round(coalesce(avg(s.total), 0), 4)
  )
  into v_totals
  from public.sales as s
  where s.tenant_id = p_tenant_id
    and s.status = 'completed'
    and (s.created_at at time zone v_timezone)::date between p_from and p_to;

  -- Aujourd'hui, quelle que soit la période choisie.
  select jsonb_build_object(
    'sales', count(*),
    'revenue', round(coalesce(sum(s.total), 0), 4),
    'margin', round(coalesce(sum(s.total - s.total_cost), 0), 4)
  )
  into v_today_stats
  from public.sales as s
  where s.tenant_id = p_tenant_id
    and s.status = 'completed'
    and (s.created_at at time zone v_timezone)::date = v_today;

  -- Série journalière, jours vides inclus.
  select coalesce(jsonb_agg(to_jsonb(day_row) order by day_row.day), '[]'::jsonb)
  into v_daily
  from (
    select
      calendar.day::date as day,
      coalesce(day_data.sales, 0) as sales,
      coalesce(day_data.revenue, 0) as revenue,
      coalesce(day_data.margin, 0) as margin
    from generate_series(p_from, p_to, interval '1 day') as calendar(day)
    left join (
      select
        (s.created_at at time zone v_timezone)::date as day,
        count(*)::integer as sales,
        round(sum(s.total), 4) as revenue,
        round(sum(s.total - s.total_cost), 4) as margin
      from public.sales as s
      where s.tenant_id = p_tenant_id
        and s.status = 'completed'
        and (s.created_at at time zone v_timezone)::date between p_from and p_to
      group by 1
    ) as day_data on day_data.day = calendar.day::date
  ) as day_row;

  -- Meilleurs produits.
  select coalesce(jsonb_agg(to_jsonb(product_row) order by product_row.revenue desc), '[]'::jsonb)
  into v_top_products
  from (
    select
      item.variant_id,
      item.product_name,
      item.sku,
      round(sum(item.quantity), 4) as quantity,
      round(sum(item.line_total), 4) as revenue,
      round(sum(item.line_total - item.unit_cost * item.quantity), 4) as margin
    from public.sale_items as item
    join public.sales as s on s.id = item.sale_id and s.tenant_id = item.tenant_id
    where item.tenant_id = p_tenant_id
      and s.status = 'completed'
      and (s.created_at at time zone v_timezone)::date between p_from and p_to
    group by item.variant_id, item.product_name, item.sku
    order by revenue desc
    limit 10
  ) as product_row;

  -- Meilleures catégories.
  select coalesce(jsonb_agg(to_jsonb(category_row) order by category_row.revenue desc), '[]'::jsonb)
  into v_top_categories
  from (
    select
      product.category_id,
      coalesce(category.name, 'Sans catégorie') as category_name,
      round(sum(item.quantity), 4) as quantity,
      round(sum(item.line_total), 4) as revenue,
      round(sum(item.line_total - item.unit_cost * item.quantity), 4) as margin
    from public.sale_items as item
    join public.sales as s on s.id = item.sale_id and s.tenant_id = item.tenant_id
    join public.product_variants as variant
      on variant.id = item.variant_id and variant.tenant_id = item.tenant_id
    join public.products as product
      on product.id = variant.product_id and product.tenant_id = variant.tenant_id
    left join public.categories as category
      on category.id = product.category_id and category.tenant_id = product.tenant_id
    where item.tenant_id = p_tenant_id
      and s.status = 'completed'
      and (s.created_at at time zone v_timezone)::date between p_from and p_to
    group by product.category_id, category.name
    order by revenue desc
    limit 5
  ) as category_row;

  -- Capital immobilisé.
  select round(coalesce(sum(balance.on_hand * product.cost_price), 0), 4)
  into v_stock_value
  from public.stock_balances as balance
  join public.product_variants as variant
    on variant.id = balance.variant_id and variant.tenant_id = balance.tenant_id
  join public.products as product
    on product.id = variant.product_id and product.tenant_id = variant.tenant_id
  where balance.tenant_id = p_tenant_id;

  -- Produits actifs.
  select count(*) into v_product_count
  from public.products where tenant_id = p_tenant_id and active;

  -- Produits dormants : du stock, mais aucune vente depuis 30 jours.
  select coalesce(jsonb_agg(to_jsonb(dormant_row) order by dormant_row.stock_value desc), '[]'::jsonb)
  into v_dormant
  from (
    select
      balance.variant_id,
      product.name as product_name,
      variant.sku,
      round(sum(balance.on_hand), 4) as on_hand,
      round(sum(balance.on_hand * product.cost_price), 4) as stock_value,
      last_sale.last_sold_at
    from public.stock_balances as balance
    join public.product_variants as variant
      on variant.id = balance.variant_id and variant.tenant_id = balance.tenant_id
    join public.products as product
      on product.id = variant.product_id and product.tenant_id = variant.tenant_id
    left join (
      select item.variant_id, max(s.created_at) as last_sold_at
      from public.sale_items as item
      join public.sales as s on s.id = item.sale_id and s.tenant_id = item.tenant_id
      where item.tenant_id = p_tenant_id and s.status = 'completed'
      group by item.variant_id
    ) as last_sale on last_sale.variant_id = balance.variant_id
    where balance.tenant_id = p_tenant_id
      and balance.on_hand > 0
      and product.active
      and (last_sale.last_sold_at is null or last_sale.last_sold_at < now() - interval '30 days')
    group by balance.variant_id, product.name, variant.sku, last_sale.last_sold_at
    order by sum(balance.on_hand * product.cost_price) desc
    limit 10
  ) as dormant_row;

  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'timezone', v_timezone,
    'totals', v_totals,
    'today', v_today_stats,
    'daily', v_daily,
    'top_products', v_top_products,
    'top_categories', v_top_categories,
    'dormant', v_dormant,
    'stock_value', v_stock_value,
    'product_count', v_product_count
  );
end;
$$;

revoke all on function public.report_summary(uuid, date, date) from public, anon;
grant execute on function public.report_summary(uuid, date, date) to authenticated;

commit;

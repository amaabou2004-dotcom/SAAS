-- 202611020007_storefront.sql
-- ---------------------------------------------------------------------------
-- Boutique publique : un lien à partager, un catalogue lisible sans compte,
-- une commande qui arrive dans l'application.
--
-- Principes de sécurité (le point le plus important) :
--   * `anon` ne reçoit AUCUN droit sur les tables. Tout passe par des fonctions
--     `security definer` qui ne renvoient que des colonnes publiques :
--     jamais le prix d'achat, jamais les autres entreprises, jamais les stocks
--     des autres emplacements.
--   * Une boutique n'est visible que si `published = true` et si l'entreprise
--     est active.
--   * Le prix envoyé par le client est ignoré : la commande est recalculée avec
--     le prix du catalogue au moment de l'envoi.
--   * Confirmer une commande crée une VENTE (moyen de paiement « crédit »),
--     donc le stock sort et le ticket existe ; annuler une commande non
--     confirmée ne touche à rien.
-- ---------------------------------------------------------------------------
begin;

-- 1. Réglages de la boutique (une ligne par entreprise).
create table if not exists public.storefront_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  slug text not null,
  display_name text,
  whatsapp text,
  published boolean not null default false,
  default_location_id uuid references public.stock_locations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storefront_settings_slug_valid check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
  ),
  constraint storefront_settings_slug_unique unique (slug)
);

-- 2. Commandes reçues.
create table if not exists public.storefront_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  seq bigint generated always as identity,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'delivered')),
  customer_name text not null,
  customer_phone text not null,
  note text,
  subtotal numeric(19, 4) not null check (subtotal >= 0),
  total numeric(19, 4) not null check (total >= 0),
  item_count integer not null check (item_count > 0),
  idempotency_key text not null,
  request_fingerprint text not null,
  sale_id uuid,
  cancel_reason text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  delivered_at timestamptz,
  constraint storefront_orders_tenant_unique unique (tenant_id, id),
  constraint storefront_orders_key_unique unique (tenant_id, idempotency_key),
  constraint storefront_orders_sale_fk foreign key (tenant_id, sale_id)
    references public.sales(tenant_id, id) on delete set null
);

create table if not exists public.storefront_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  order_id uuid not null,
  variant_id uuid not null,
  product_name text not null,
  sku text not null,
  unit_price numeric(19, 4) not null check (unit_price >= 0),
  quantity numeric(19, 4) not null check (quantity > 0),
  line_total numeric(19, 4) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  constraint storefront_order_items_order_fk foreign key (tenant_id, order_id)
    references public.storefront_orders(tenant_id, id) on delete cascade,
  constraint storefront_order_items_unique unique (order_id, variant_id)
);

create index if not exists storefront_orders_tenant_status_idx
  on public.storefront_orders (tenant_id, status, created_at desc);

-- 3. RLS : le commerçant lit, les fonctions écrivent, `anon` n'a rien.
alter table public.storefront_settings enable row level security;
alter table public.storefront_orders enable row level security;
alter table public.storefront_order_items enable row level security;

drop policy if exists storefront_settings_member_read on public.storefront_settings;
create policy storefront_settings_member_read on public.storefront_settings
  for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists storefront_orders_read on public.storefront_orders;
create policy storefront_orders_read on public.storefront_orders
  for select to authenticated
  using (
    public.has_tenant_permission(tenant_id, 'sales.read')
    or public.has_tenant_permission(tenant_id, 'sales.manage')
  );

drop policy if exists storefront_order_items_read on public.storefront_order_items;
create policy storefront_order_items_read on public.storefront_order_items
  for select to authenticated
  using (
    public.has_tenant_permission(tenant_id, 'sales.read')
    or public.has_tenant_permission(tenant_id, 'sales.manage')
  );

revoke all on table public.storefront_settings from anon;
revoke all on table public.storefront_orders from anon;
revoke all on table public.storefront_order_items from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.storefront_settings, public.storefront_orders, public.storefront_order_items
  from authenticated;
grant select on table public.storefront_settings, public.storefront_orders, public.storefront_order_items
  to authenticated;

-- 4. Vitrine publique : informations de la boutique.
create or replace function public.storefront_info(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.storefront_settings;
  v_tenant public.tenants;
begin
  select * into v_settings from public.storefront_settings where slug = lower(btrim(coalesce(p_slug, '')));
  if not found or not v_settings.published then
    return null;
  end if;

  select * into v_tenant from public.tenants where id = v_settings.tenant_id;
  if not found or v_tenant.status <> 'active' then
    return null;
  end if;

  return jsonb_build_object(
    'slug', v_settings.slug,
    'display_name', coalesce(nullif(btrim(coalesce(v_settings.display_name, '')), ''), v_tenant.name),
    'whatsapp', nullif(btrim(coalesce(v_settings.whatsapp, '')), ''),
    'currency_code', v_tenant.currency_code,
    'timezone', v_tenant.timezone,
    'tenant_name', v_tenant.name
  );
end;
$$;

-- 5. Vitrine publique : catalogue (prix de vente et disponibilité uniquement).
create or replace function public.storefront_catalog(p_slug text)
returns table (
  product_id uuid,
  variant_id uuid,
  name text,
  description text,
  sku text,
  category_name text,
  unit_price numeric,
  available numeric,
  currency_code text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.storefront_settings;
  v_tenant public.tenants;
begin
  select * into v_settings from public.storefront_settings where slug = lower(btrim(coalesce(p_slug, '')));
  if not found or not v_settings.published then
    return;
  end if;

  select * into v_tenant from public.tenants where id = v_settings.tenant_id;
  if not found or v_tenant.status <> 'active' then
    return;
  end if;

  return query
    select
      product.id,
      variant.id,
      product.name::text,
      coalesce(product.description, '')::text,
      variant.sku::text,
      coalesce(category.name, '')::text,
      round(product.sale_price, 4),
      round(coalesce(sum(balance.on_hand - balance.reserved), 0), 4),
      v_tenant.currency_code::text
    from public.products as product
    join public.product_variants as variant
      on variant.product_id = product.id and variant.tenant_id = product.tenant_id
    left join public.categories as category
      on category.id = product.category_id and category.tenant_id = product.tenant_id
    left join public.stock_balances as balance
      on balance.tenant_id = product.tenant_id
     and balance.variant_id = variant.id
     and (v_settings.default_location_id is null or balance.location_id = v_settings.default_location_id)
    where product.tenant_id = v_settings.tenant_id
      and product.active
      and variant.active
    group by product.id, variant.id, category.name, v_tenant.currency_code
    having coalesce(sum(balance.on_hand - balance.reserved), 0) > 0
    order by product.name, variant.sku;
end;
$$;

-- 6. Commander sans compte.
create or replace function public.place_storefront_order(
  p_slug text,
  p_idempotency_key text,
  p_customer_name text,
  p_customer_phone text,
  p_note text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.storefront_settings;
  v_tenant public.tenants;
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_name text := btrim(coalesce(p_customer_name, ''));
  v_phone text := btrim(coalesce(p_customer_phone, ''));
  v_fingerprint text;
  v_existing public.storefront_orders;
  v_order_id uuid;
  v_seq bigint;
  v_number text;
  v_total numeric(19, 4);
  v_lines integer;
  v_resolved integer;
  v_pending integer;
begin
  select * into v_settings from public.storefront_settings where slug = lower(btrim(coalesce(p_slug, '')));
  if not found or not v_settings.published then
    raise exception 'Boutique introuvable ou fermée.' using errcode = 'P0002';
  end if;

  select * into v_tenant from public.tenants where id = v_settings.tenant_id;
  if not found or v_tenant.status <> 'active' then
    raise exception 'Boutique indisponible.' using errcode = 'P0002';
  end if;

  if v_key = '' or char_length(v_key) not between 8 and 100 then
    raise exception 'Clé d’envoi invalide.' using errcode = '22023';
  end if;
  if char_length(v_name) not between 2 and 120 then
    raise exception 'Indiquez votre nom (2 à 120 caractères).' using errcode = '22023';
  end if;
  if char_length(v_phone) not between 6 and 32
    or v_phone !~ '^[0-9+() .-]+$' then
    raise exception 'Indiquez un numéro de téléphone valide.' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Note trop longue (500 caractères maximum).' using errcode = '22023';
  end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'Ajoutez au moins un produit.' using errcode = '22023';
  end if;
  if jsonb_array_length(v_items) > 50 then
    raise exception 'Trop de produits dans la commande (50 maximum).' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_items) as element
    where jsonb_typeof(element) <> 'object'
       or not (element ? 'variant_id')
       or not (element ? 'quantity')
  ) then
    raise exception 'Ligne de commande invalide.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(v_items) as item(variant_id uuid, quantity numeric)
    where item.variant_id is null
       or item.quantity is null
       or item.quantity <= 0
       or item.quantity <> round(item.quantity, 4)
  ) then
    raise exception 'Quantité invalide.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(v_items) as item(variant_id uuid, quantity numeric)
    group by item.variant_id having count(*) > 1
  ) then
    raise exception 'Produit présent deux fois dans la commande.' using errcode = '22023';
  end if;

  -- Garde-fou anti-abus : une boutique en attente ne doit pas être noyée.
  select count(*) into v_pending
  from public.storefront_orders
  where tenant_id = v_settings.tenant_id and status = 'pending';
  if v_pending >= 500 then
    raise exception 'La boutique ne prend plus de commande pour le moment. Contactez le commerçant.' using errcode = 'P0001';
  end if;

  v_fingerprint := encode(extensions.digest(
    jsonb_build_object(
      'name', v_name,
      'phone', v_phone,
      'note', nullif(btrim(coalesce(p_note, '')), ''),
      'items', v_items
    )::text,
    'sha256'
  ), 'hex');

  select * into v_existing
  from public.storefront_orders
  where tenant_id = v_settings.tenant_id and idempotency_key = v_key;
  if found then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'Cette commande a déjà été envoyée avec d’autres informations.' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'id', v_existing.id,
      'number', 'CMD-' || lpad(v_existing.seq::text, 6, '0'),
      'total', v_existing.total,
      'item_count', v_existing.item_count,
      'status', v_existing.status
    );
  end if;

  select count(*) into v_lines
  from jsonb_to_recordset(v_items) as item(variant_id uuid, quantity numeric);

  select count(*) into v_resolved
  from jsonb_to_recordset(v_items) as item(variant_id uuid, quantity numeric)
  join public.product_variants as variant
    on variant.tenant_id = v_settings.tenant_id and variant.id = item.variant_id
  join public.products as product
    on product.tenant_id = variant.tenant_id and product.id = variant.product_id
  where product.active and variant.active;

  if v_resolved <> v_lines then
    raise exception 'Un produit de la commande n’est plus disponible.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_items) as item(variant_id uuid, quantity numeric)
    join lateral (
      select coalesce(sum(balance.on_hand - balance.reserved), 0) as available
      from public.stock_balances as balance
      where balance.tenant_id = v_settings.tenant_id
        and balance.variant_id = item.variant_id
        and (v_settings.default_location_id is null or balance.location_id = v_settings.default_location_id)
    ) as stock on true
    where stock.available < item.quantity
  ) then
    raise exception 'Stock insuffisant pour un des produits choisis.' using errcode = 'P0001';
  end if;

  select round(coalesce(sum(product.sale_price * item.quantity), 0), 4)
  into v_total
  from jsonb_to_recordset(v_items) as item(variant_id uuid, quantity numeric)
  join public.product_variants as variant
    on variant.tenant_id = v_settings.tenant_id and variant.id = item.variant_id
  join public.products as product
    on product.tenant_id = variant.tenant_id and product.id = variant.product_id;

  insert into public.storefront_orders (
    tenant_id, customer_name, customer_phone, note,
    subtotal, total, item_count, idempotency_key, request_fingerprint
  ) values (
    v_settings.tenant_id, v_name, v_phone,
    nullif(btrim(coalesce(p_note, '')), ''),
    v_total, v_total, v_lines, v_key, v_fingerprint
  )
  on conflict (tenant_id, idempotency_key) do nothing
  returning id, seq into v_order_id, v_seq;

  if v_order_id is null then
    -- Course entre deux envois simultanés : on renvoie la commande déjà créée.
    select * into v_existing
    from public.storefront_orders
    where tenant_id = v_settings.tenant_id and idempotency_key = v_key;
    if not found then
      raise exception 'Commande introuvable après envoi.' using errcode = 'P0001';
    end if;
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'Cette commande a déjà été envoyée avec d’autres informations.' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'id', v_existing.id,
      'number', 'CMD-' || lpad(v_existing.seq::text, 6, '0'),
      'total', v_existing.total,
      'item_count', v_existing.item_count,
      'status', v_existing.status
    );
  end if;

  v_number := 'CMD-' || lpad(v_seq::text, 6, '0');

  insert into public.storefront_order_items (
    tenant_id, order_id, variant_id, product_name, sku, unit_price, quantity, line_total
  )
  select
    v_settings.tenant_id, v_order_id, variant.id, product.name, variant.sku,
    round(product.sale_price, 4), item.quantity, round(product.sale_price * item.quantity, 4)
  from jsonb_to_recordset(v_items) as item(variant_id uuid, quantity numeric)
  join public.product_variants as variant
    on variant.tenant_id = v_settings.tenant_id and variant.id = item.variant_id
  join public.products as product
    on product.tenant_id = variant.tenant_id and product.id = variant.product_id;

  return jsonb_build_object(
    'id', v_order_id,
    'number', v_number,
    'total', v_total,
    'item_count', v_lines,
    'status', 'pending'
  );
end;
$$;

-- 7. Réglages côté commerçant.
create or replace function public.storefront_settings_get(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.storefront_settings;
  v_tenant public.tenants;
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'Vous n’avez pas accès à cette entreprise.' using errcode = '42501';
  end if;

  select * into v_tenant from public.tenants where id = p_tenant_id;
  select * into v_settings from public.storefront_settings where tenant_id = p_tenant_id;

  if not found then
    return jsonb_build_object(
      'tenant_id', p_tenant_id,
      'slug', '',
      'display_name', v_tenant.name,
      'whatsapp', null,
      'published', false,
      'default_location_id', null,
      'public_path', null,
      'currency_code', v_tenant.currency_code
    );
  end if;

  return jsonb_build_object(
    'tenant_id', p_tenant_id,
    'slug', v_settings.slug,
    'display_name', coalesce(v_settings.display_name, v_tenant.name),
    'whatsapp', v_settings.whatsapp,
    'published', v_settings.published,
    'default_location_id', v_settings.default_location_id,
    'public_path', case when v_settings.published then '/b/' || v_settings.slug else null end,
    'currency_code', v_tenant.currency_code
  );
end;
$$;

create or replace function public.storefront_settings_save(
  p_tenant_id uuid,
  p_slug text,
  p_display_name text,
  p_whatsapp text,
  p_published boolean,
  p_default_location_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_name text := nullif(btrim(coalesce(p_display_name, '')), '');
  v_whatsapp text := nullif(btrim(coalesce(p_whatsapp, '')), '');
begin
  if not public.has_tenant_permission(p_tenant_id, 'stores.manage') then
    raise exception 'Seul un administrateur peut modifier la boutique.' using errcode = '42501';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' then
    raise exception 'Adresse de boutique invalide : 3 à 40 caractères, lettres minuscules, chiffres et tirets.' using errcode = '22023';
  end if;
  if v_name is not null and char_length(v_name) > 80 then
    raise exception 'Nom affiché trop long (80 caractères maximum).' using errcode = '22023';
  end if;
  if v_whatsapp is not null and (char_length(v_whatsapp) > 32 or v_whatsapp !~ '^[0-9+() .-]+$') then
    raise exception 'Numéro WhatsApp invalide.' using errcode = '22023';
  end if;
  if p_default_location_id is not null and not exists (
    select 1 from public.stock_locations
    where id = p_default_location_id and tenant_id = p_tenant_id and active
  ) then
    raise exception 'Emplacement inconnu pour cette entreprise.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.storefront_settings
    where slug = v_slug and tenant_id <> p_tenant_id
  ) then
    raise exception 'Cette adresse de boutique est déjà prise.' using errcode = '23505';
  end if;

  insert into public.storefront_settings (
    tenant_id, slug, display_name, whatsapp, published, default_location_id
  ) values (
    p_tenant_id, v_slug, v_name, v_whatsapp, coalesce(p_published, false), p_default_location_id
  )
  on conflict (tenant_id) do update
    set slug = excluded.slug,
        display_name = excluded.display_name,
        whatsapp = excluded.whatsapp,
        published = excluded.published,
        default_location_id = excluded.default_location_id,
        updated_at = now();

  return public.storefront_settings_get(p_tenant_id);
end;
$$;

-- 8. Commandes côté commerçant.
create or replace function public.storefront_orders_list(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_orders jsonb;
begin
  if not (
    public.has_tenant_permission(p_tenant_id, 'sales.read')
    or public.has_tenant_permission(p_tenant_id, 'sales.manage')
  ) then
    raise exception 'Vous n’avez pas accès aux commandes de cette entreprise.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(order_row) order by order_row.created_at desc), '[]'::jsonb)
  into v_orders
  from (
    select
      orders.id,
      'CMD-' || lpad(orders.seq::text, 6, '0') as number,
      orders.status,
      orders.customer_name,
      orders.customer_phone,
      orders.note,
      orders.subtotal,
      orders.total,
      orders.item_count,
      orders.sale_id,
      orders.cancel_reason,
      orders.created_at,
      orders.confirmed_at,
      orders.delivered_at,
      orders.cancelled_at,
      coalesce(
        (
          select jsonb_agg(jsonb_build_object(
            'variant_id', item.variant_id,
            'product_name', item.product_name,
            'sku', item.sku,
            'unit_price', item.unit_price,
            'quantity', item.quantity,
            'line_total', item.line_total
          ) order by item.product_name)
          from public.storefront_order_items as item
          where item.order_id = orders.id
        ),
        '[]'::jsonb
      ) as items
    from public.storefront_orders as orders
    where orders.tenant_id = p_tenant_id
    order by orders.created_at desc
    limit 100
  ) as order_row;

  return v_orders;
end;
$$;

create or replace function public.storefront_confirm_order(
  p_tenant_id uuid,
  p_order_id uuid,
  p_location_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.storefront_orders;
  v_settings public.storefront_settings;
  v_location uuid;
  v_sale_id uuid;
  v_sale public.sales_overview;
  v_items jsonb;
begin
  if not public.has_tenant_permission(p_tenant_id, 'sales.manage') then
    raise exception 'Votre compte n’a pas le droit d’encaisser cette commande.' using errcode = '42501';
  end if;

  select * into v_order
  from public.storefront_orders
  where id = p_order_id and tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'Commande introuvable.' using errcode = 'P0002';
  end if;
  if v_order.status <> 'pending' then
    raise exception 'Cette commande a déjà été traitée.' using errcode = '22023';
  end if;

  select * into v_settings from public.storefront_settings where tenant_id = p_tenant_id;
  v_location := coalesce(p_location_id, v_settings.default_location_id);

  if v_location is null then
    raise exception 'Choisissez l’emplacement qui sort le stock avant de confirmer.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.stock_locations
    where id = v_location and tenant_id = p_tenant_id and active
  ) then
    raise exception 'Emplacement inconnu pour cette entreprise.' using errcode = '22023';
  end if;

  select jsonb_agg(jsonb_build_object(
    'variant_id', item.variant_id,
    'quantity', item.quantity,
    'unit_price', item.unit_price
  ))
  into v_items
  from public.storefront_order_items as item
  where item.order_id = v_order.id;

  -- La commande devient une vente : stock sorti, ticket numéroté, marge calculée.
  v_sale_id := public.post_sale(
    p_tenant_id,
    'commande:' || v_order.id::text,
    v_location,
    'credit',
    null,
    left(v_order.customer_name || ' · ' || v_order.customer_phone, 120),
    coalesce(v_order.note, 'Commande boutique ' || 'CMD-' || lpad(v_order.seq::text, 6, '0')),
    v_items
  );

  update public.storefront_orders
  set status = 'confirmed', confirmed_at = now(), sale_id = v_sale_id
  where id = v_order.id;

  select * into v_sale from public.sales_overview where id = v_sale_id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'number', 'CMD-' || lpad(v_order.seq::text, 6, '0'),
    'status', 'confirmed',
    'sale_id', v_sale_id,
    'sale_number', v_sale.number,
    'total', v_sale.total
  );
end;
$$;

create or replace function public.storefront_cancel_order(
  p_tenant_id uuid,
  p_order_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.has_tenant_permission(p_tenant_id, 'sales.manage') then
    raise exception 'Votre compte n’a pas le droit d’annuler cette commande.' using errcode = '42501';
  end if;
  if char_length(v_reason) not between 2 and 400 then
    raise exception 'Indiquez le motif de l’annulation (2 à 400 caractères).' using errcode = '22023';
  end if;

  select status into v_status
  from public.storefront_orders
  where id = p_order_id and tenant_id = p_tenant_id
  for update;

  if v_status is null then
    raise exception 'Commande introuvable.' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    raise exception 'Cette commande a déjà été traitée : annulez la vente depuis l’onglet Ventes.' using errcode = '22023';
  end if;

  update public.storefront_orders
  set status = 'cancelled', cancelled_at = now(), cancel_reason = v_reason
  where id = p_order_id and tenant_id = p_tenant_id;
end;
$$;

create or replace function public.storefront_mark_delivered(
  p_tenant_id uuid,
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  if not public.has_tenant_permission(p_tenant_id, 'sales.manage') then
    raise exception 'Votre compte n’a pas le droit de modifier cette commande.' using errcode = '42501';
  end if;

  select status into v_status
  from public.storefront_orders
  where id = p_order_id and tenant_id = p_tenant_id
  for update;

  if v_status is null then
    raise exception 'Commande introuvable.' using errcode = 'P0002';
  end if;
  if v_status <> 'confirmed' then
    raise exception 'Seule une commande confirmée peut être marquée livrée.' using errcode = '22023';
  end if;

  update public.storefront_orders
  set status = 'delivered', delivered_at = now()
  where id = p_order_id and tenant_id = p_tenant_id;
end;
$$;

-- 9. Droits d'exécution.
revoke all on function public.storefront_info(text) from public;
revoke all on function public.storefront_catalog(text) from public;
revoke all on function public.place_storefront_order(text, text, text, text, text, jsonb) from public;
revoke all on function public.storefront_settings_get(uuid) from public, anon;
revoke all on function public.storefront_settings_save(uuid, text, text, text, boolean, uuid) from public, anon;
revoke all on function public.storefront_orders_list(uuid) from public, anon;
revoke all on function public.storefront_confirm_order(uuid, uuid, uuid) from public, anon;
revoke all on function public.storefront_cancel_order(uuid, uuid, text) from public, anon;
revoke all on function public.storefront_mark_delivered(uuid, uuid) from public, anon;

grant execute on function public.storefront_info(text) to anon, authenticated;
grant execute on function public.storefront_catalog(text) to anon, authenticated;
grant execute on function public.place_storefront_order(text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.storefront_settings_get(uuid) to authenticated;
grant execute on function public.storefront_settings_save(uuid, text, text, text, boolean, uuid) to authenticated;
grant execute on function public.storefront_orders_list(uuid) to authenticated;
grant execute on function public.storefront_confirm_order(uuid, uuid, uuid) to authenticated;
grant execute on function public.storefront_cancel_order(uuid, uuid, text) to authenticated;
grant execute on function public.storefront_mark_delivered(uuid, uuid) to authenticated;

commit;

-- Kanti — extension du socle inventaire
-- 1. Fournisseurs (tenant-scoped)
-- 2. Colonnes produit : fournisseur, unité, seuil d'alerte, quantité de réappro, emplacement
-- 3. Opérations de stock : sortie ('issue') et inventaire ('inventory')
-- 4. RPC : upsert_product enrichi, save_supplier, delete_supplier, delete_product,
--          update_tenant_settings, seed_demo_data, seed_demo_history

-- ---------------------------------------------------------------- 1. Fournisseurs
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  contact text,
  phone text,
  email text,
  city text,
  lead_time_days integer not null default 7,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_name_valid check (name = btrim(name) and char_length(name) between 2 and 120),
  constraint suppliers_lead_time_valid check (lead_time_days between 0 and 365),
  constraint suppliers_contact_valid check (contact is null or char_length(contact) <= 120),
  constraint suppliers_phone_valid check (phone is null or char_length(phone) <= 40),
  constraint suppliers_email_valid check (email is null or (char_length(email) <= 160 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  constraint suppliers_city_valid check (city is null or char_length(city) <= 80),
  constraint suppliers_notes_valid check (notes is null or char_length(notes) <= 2000),
  constraint suppliers_tenant_id_id_unique unique (tenant_id, id),
  constraint suppliers_tenant_name_unique unique (tenant_id, name)
);

alter table public.suppliers enable row level security;

create policy suppliers_read_permission on public.suppliers
  for select to authenticated
  using (
    public.has_tenant_permission(tenant_id, 'catalog.read')
    or public.has_tenant_permission(tenant_id, 'inventory.read')
  );

grant select on public.suppliers to authenticated;

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- 2. Colonnes produit
alter table public.products
  add column if not exists supplier_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_supplier_same_tenant' and connamespace = 'public'::regnamespace
  ) then
    alter table public.products
      add constraint products_supplier_same_tenant
      foreign key (tenant_id, supplier_id) references public.suppliers(tenant_id, id)
      on delete no action;
  end if;
end;
$$;

create index if not exists products_supplier_idx on public.products(tenant_id, supplier_id);

alter table public.product_variants
  add column if not exists unit text not null default 'pièce',
  add column if not exists reorder_point numeric(19, 4) not null default 0,
  add column if not exists reorder_qty numeric(19, 4) not null default 1,
  add column if not exists storage_label text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_variants_unit_valid' and connamespace = 'public'::regnamespace) then
    alter table public.product_variants
      add constraint product_variants_unit_valid check (unit = btrim(unit) and char_length(unit) between 1 and 40),
      add constraint product_variants_reorder_valid check (reorder_point >= 0 and reorder_qty >= 0),
      add constraint product_variants_storage_valid check (storage_label is null or char_length(storage_label) <= 80);
  end if;
end;
$$;

-- ---------------------------------------------------------------- 3. Types d'opération
alter table public.stock_operations drop constraint if exists stock_operations_type_valid;
alter table public.stock_operations
  add constraint stock_operations_type_valid
  check (operation_type in ('opening', 'receipt', 'issue', 'adjustment', 'inventory', 'transfer', 'reversal'));

-- ---------------------------------------------------------------- 4. upsert_product enrichi
drop function if exists public.upsert_product(uuid, uuid, uuid, uuid, text, text, numeric, numeric, text, text, jsonb, boolean);

create or replace function public.upsert_product(
  p_tenant_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_category_id uuid,
  p_name text,
  p_description text,
  p_sale_price numeric,
  p_cost_price numeric,
  p_sku text,
  p_barcode text,
  p_attributes jsonb,
  p_active boolean,
  p_supplier_id uuid default null,
  p_unit text default null,
  p_reorder_point numeric default null,
  p_reorder_qty numeric default null,
  p_storage_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  saved_product public.products%rowtype;
  saved_variant public.product_variants%rowtype;
  v_unit text := coalesce(nullif(btrim(p_unit), ''), 'pièce');
  v_storage text := nullif(btrim(p_storage_label), '');
begin
  if (select auth.uid()) is null
    or not public.has_tenant_permission(p_tenant_id, 'catalog.manage') then
    raise exception 'Catalog management permission required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id and status = 'active') then
    raise exception 'Active tenant required' using errcode = '42501';
  end if;
  if p_name is null or p_name <> btrim(p_name) or char_length(p_name) not between 2 and 160 then
    raise exception 'Invalid product name' using errcode = '22023';
  end if;
  if p_description is not null and char_length(p_description) > 5000 then
    raise exception 'Invalid product description' using errcode = '22023';
  end if;
  if p_sale_price is null or p_sale_price < 0 or p_sale_price <> round(p_sale_price, 4)
    or p_cost_price is null or p_cost_price < 0 or p_cost_price <> round(p_cost_price, 4) then
    raise exception 'Invalid product prices' using errcode = '22023';
  end if;
  if p_sku is null or p_sku <> upper(btrim(p_sku)) or p_sku !~ '^[A-Z0-9][A-Z0-9._-]{0,79}$' then
    raise exception 'Invalid SKU' using errcode = '22023';
  end if;
  if p_barcode is not null and (p_barcode <> btrim(p_barcode) or char_length(p_barcode) not between 1 and 80) then
    raise exception 'Invalid barcode' using errcode = '22023';
  end if;
  if p_attributes is null or jsonb_typeof(p_attributes) <> 'object' or p_active is null then
    raise exception 'Invalid variant data' using errcode = '22023';
  end if;
  if char_length(v_unit) not between 1 and 40 then
    raise exception 'Invalid unit' using errcode = '22023';
  end if;
  if coalesce(p_reorder_point, 0) < 0 or coalesce(p_reorder_qty, 0) < 0 then
    raise exception 'Invalid reorder settings' using errcode = '22023';
  end if;
  if p_category_id is not null and not exists (
    select 1 from public.categories where tenant_id = p_tenant_id and id = p_category_id
  ) then
    raise exception 'Category not found' using errcode = '22023';
  end if;
  if p_supplier_id is not null and not exists (
    select 1 from public.suppliers where tenant_id = p_tenant_id and id = p_supplier_id
  ) then
    raise exception 'Supplier not found' using errcode = '22023';
  end if;

  if p_product_id is null then
    if p_variant_id is not null then
      raise exception 'Unexpected variant identifier' using errcode = '22023';
    end if;
    insert into public.products(
      tenant_id, category_id, name, description, sale_price, cost_price, active, supplier_id
    ) values (
      p_tenant_id, p_category_id, p_name, nullif(p_description, ''), p_sale_price, p_cost_price, p_active, p_supplier_id
    ) returning * into saved_product;

    insert into public.product_variants(
      tenant_id, product_id, sku, barcode, attributes, active, unit, reorder_point, reorder_qty, storage_label
    ) values (
      p_tenant_id, saved_product.id, p_sku, nullif(p_barcode, ''), p_attributes, p_active,
      v_unit, coalesce(p_reorder_point, 0), coalesce(p_reorder_qty, 1), v_storage
    ) returning * into saved_variant;
  else
    if p_variant_id is null then
      raise exception 'Variant identifier required' using errcode = '22023';
    end if;
    update public.products
    set category_id = p_category_id,
        name = p_name,
        description = nullif(p_description, ''),
        sale_price = p_sale_price,
        cost_price = p_cost_price,
        active = p_active,
        supplier_id = p_supplier_id
    where tenant_id = p_tenant_id and id = p_product_id
    returning * into saved_product;
    if not found then
      raise exception 'Product not found' using errcode = '22023';
    end if;

    update public.product_variants
    set sku = p_sku,
        barcode = nullif(p_barcode, ''),
        attributes = p_attributes,
        active = p_active,
        unit = v_unit,
        reorder_point = coalesce(p_reorder_point, reorder_point),
        reorder_qty = coalesce(p_reorder_qty, reorder_qty),
        storage_label = v_storage
    where tenant_id = p_tenant_id and id = p_variant_id and product_id = p_product_id
    returning * into saved_variant;
    if not found then
      raise exception 'Variant not found' using errcode = '22023';
    end if;
  end if;

  return jsonb_build_object('product', to_jsonb(saved_product), 'variant', to_jsonb(saved_variant));
end;
$function$;

revoke all on function public.upsert_product(uuid, uuid, uuid, uuid, text, text, numeric, numeric, text, text, jsonb, boolean, uuid, text, numeric, numeric, text) from public;
grant execute on function public.upsert_product(uuid, uuid, uuid, uuid, text, text, numeric, numeric, text, text, jsonb, boolean, uuid, text, numeric, numeric, text) to authenticated;

-- ---------------------------------------------------------------- 5. post_stock_operation (sorties + inventaire)
create or replace function public.post_stock_operation(
  p_tenant_id uuid,
  p_operation_type text,
  p_idempotency_key text,
  p_reason text,
  p_reference text,
  p_lines jsonb,
  p_reverses_operation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  v_lines jsonb := coalesce(p_lines, '[]'::jsonb);
  v_fingerprint text;
  v_operation_id uuid;
  v_existing_id uuid;
  v_existing_fingerprint text;
  v_original public.stock_operations%rowtype;
  v_line record;
  v_on_hand numeric(19, 4);
  v_reserved numeric(19, 4);
  v_new_on_hand numeric(19, 4);
begin
  if current_user_id is null
    or not public.has_tenant_permission(p_tenant_id, 'inventory.manage') then
    raise exception 'Inventory management permission required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id and status = 'active') then
    raise exception 'Active tenant required' using errcode = '42501';
  end if;
  if p_operation_type not in ('opening', 'receipt', 'issue', 'adjustment', 'inventory', 'transfer', 'reversal') then
    raise exception 'Invalid stock operation type' using errcode = '22023';
  end if;
  if p_idempotency_key is null or p_idempotency_key <> btrim(p_idempotency_key)
    or char_length(p_idempotency_key) not between 8 and 100 then
    raise exception 'Invalid idempotency key' using errcode = '22023';
  end if;
  if p_reason is not null and char_length(btrim(p_reason)) not between 2 and 500 then
    raise exception 'Invalid operation reason' using errcode = '22023';
  end if;
  if p_operation_type in ('adjustment', 'inventory', 'reversal')
    and (p_reason is null or char_length(btrim(p_reason)) < 2) then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  if p_reference is not null and char_length(p_reference) > 120 then
    raise exception 'Invalid operation reference' using errcode = '22023';
  end if;
  if jsonb_typeof(v_lines) <> 'array' then
    raise exception 'Stock lines must be an array' using errcode = '22023';
  end if;

  v_fingerprint := encode(extensions.digest(
    jsonb_build_object(
      'type', p_operation_type,
      'reason', p_reason,
      'reference', p_reference,
      'lines', v_lines,
      'reverses', p_reverses_operation_id
    )::text,
    'sha256'
  ), 'hex');

  select id, request_fingerprint into v_existing_id, v_existing_fingerprint
  from public.stock_operations
  where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_fingerprint <> v_fingerprint then
      raise exception 'Idempotency key payload mismatch' using errcode = '22023';
    end if;
    return v_existing_id;
  end if;

  insert into public.stock_operations(
    tenant_id, operation_type, idempotency_key, request_fingerprint,
    actor_user_id, reason, reference, reverses_operation_id
  ) values (
    p_tenant_id, p_operation_type, p_idempotency_key, v_fingerprint,
    current_user_id, nullif(btrim(p_reason), ''), nullif(btrim(p_reference), ''), p_reverses_operation_id
  )
  on conflict (tenant_id, idempotency_key) do nothing
  returning id into v_operation_id;

  if v_operation_id is null then
    select id, request_fingerprint into v_existing_id, v_existing_fingerprint
    from public.stock_operations
    where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
    if v_existing_fingerprint <> v_fingerprint then
      raise exception 'Idempotency key payload mismatch' using errcode = '22023';
    end if;
    return v_existing_id;
  end if;

  if p_operation_type = 'reversal' then
    if p_reverses_operation_id is null or jsonb_array_length(v_lines) <> 0 then
      raise exception 'Invalid reversal request' using errcode = '22023';
    end if;
    select * into v_original
    from public.stock_operations
    where tenant_id = p_tenant_id and id = p_reverses_operation_id
    for update;
    if not found or v_original.operation_type = 'reversal' or v_original.status <> 'posted' then
      raise exception 'Operation cannot be reversed' using errcode = '22023';
    end if;
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'variant_id', movement.variant_id,
        'location_id', movement.location_id,
        'quantity_delta', -movement.quantity_delta
      ) order by movement.variant_id, movement.location_id
    ), '[]'::jsonb)
    into v_lines
    from public.stock_movements as movement
    where movement.tenant_id = p_tenant_id and movement.operation_id = p_reverses_operation_id;
  elsif p_reverses_operation_id is not null then
    raise exception 'Unexpected reversal reference' using errcode = '22023';
  end if;

  if jsonb_array_length(v_lines) = 0 then
    raise exception 'At least one stock line is required' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_lines) as element where jsonb_typeof(element) <> 'object') then
    raise exception 'Invalid stock line' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_lines) as element
    where not (element ?& array['variant_id', 'location_id', 'quantity_delta'])
       or (select count(*) from jsonb_object_keys(element)) <> 3
  ) then
    raise exception 'Invalid stock line fields' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(v_lines) as line(variant_id uuid, location_id uuid, quantity_delta numeric)
    where line.variant_id is null or line.location_id is null
       or line.quantity_delta is null or line.quantity_delta = 0
       or line.quantity_delta <> round(line.quantity_delta, 4)
  ) then
    raise exception 'Invalid stock quantity' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(v_lines) as line(variant_id uuid, location_id uuid, quantity_delta numeric)
    group by line.variant_id, line.location_id having count(*) > 1
  ) then
    raise exception 'Duplicate stock line' using errcode = '22023';
  end if;
  if p_operation_type in ('opening', 'receipt') and exists (
    select 1 from jsonb_to_recordset(v_lines) as line(variant_id uuid, location_id uuid, quantity_delta numeric)
    where line.quantity_delta <= 0
  ) then
    raise exception 'Incoming quantities must be positive' using errcode = '22023';
  end if;
  if p_operation_type = 'issue' and exists (
    select 1 from jsonb_to_recordset(v_lines) as line(variant_id uuid, location_id uuid, quantity_delta numeric)
    where line.quantity_delta >= 0
  ) then
    raise exception 'Outgoing quantities must be negative' using errcode = '22023';
  end if;
  if p_operation_type = 'transfer' and (
    jsonb_array_length(v_lines) < 2 or exists (
      select 1 from jsonb_to_recordset(v_lines) as line(variant_id uuid, location_id uuid, quantity_delta numeric)
      group by line.variant_id having count(*) < 2 or sum(line.quantity_delta) <> 0
    )
  ) then
    raise exception 'Transfer must balance each variant across locations' using errcode = '22023';
  end if;

  for v_line in
    select line.variant_id, line.location_id, line.quantity_delta
    from jsonb_to_recordset(v_lines) as line(variant_id uuid, location_id uuid, quantity_delta numeric)
    order by line.variant_id, line.location_id
  loop
    if not exists (
      select 1 from public.product_variants as variant
      join public.products as product
        on product.tenant_id = variant.tenant_id and product.id = variant.product_id
      where variant.tenant_id = p_tenant_id and variant.id = v_line.variant_id
    ) or not exists (
      select 1 from public.stock_locations as location
      where location.tenant_id = p_tenant_id and location.id = v_line.location_id
    ) then
      raise exception 'Stock line references an unknown variant or location' using errcode = '22023';
    end if;

    insert into public.stock_balances(tenant_id, variant_id, location_id, on_hand, reserved)
    values (p_tenant_id, v_line.variant_id, v_line.location_id, 0, 0)
    on conflict (tenant_id, variant_id, location_id) do nothing;

    select on_hand, reserved into v_on_hand, v_reserved
    from public.stock_balances
    where tenant_id = p_tenant_id and variant_id = v_line.variant_id and location_id = v_line.location_id
    for update;

    v_new_on_hand := v_on_hand + v_line.quantity_delta;
    if p_operation_type = 'inventory' and v_new_on_hand < 0 then
      raise exception 'Counted quantity cannot be negative' using errcode = '22023';
    end if;
    if v_new_on_hand < 0 or v_new_on_hand < v_reserved then
      raise exception 'Insufficient available stock' using errcode = 'P0001';
    end if;

    update public.stock_balances
    set on_hand = v_new_on_hand
    where tenant_id = p_tenant_id and variant_id = v_line.variant_id and location_id = v_line.location_id;

    insert into public.stock_movements(
      tenant_id, operation_id, variant_id, location_id, quantity_delta, on_hand_after, reserved_after
    ) values (
      p_tenant_id, v_operation_id, v_line.variant_id, v_line.location_id, v_line.quantity_delta, v_new_on_hand, v_reserved
    );
  end loop;

  if p_operation_type = 'reversal' then
    update public.stock_operations
    set status = 'reversed'
    where tenant_id = p_tenant_id and id = p_reverses_operation_id;
  end if;

  return v_operation_id;
end;
$function$;

revoke all on function public.post_stock_operation(uuid, text, text, text, text, jsonb, uuid) from public;
grant execute on function public.post_stock_operation(uuid, text, text, text, text, jsonb, uuid) to authenticated;

-- ---------------------------------------------------------------- 6. Fournisseurs : RPC
create or replace function public.save_supplier(
  p_tenant_id uuid,
  p_supplier_id uuid,
  p_name text,
  p_contact text,
  p_phone text,
  p_email text,
  p_city text,
  p_lead_time_days integer,
  p_notes text,
  p_active boolean
)
returns public.suppliers
language plpgsql
security definer
set search_path to ''
as $function$
declare
  saved public.suppliers%rowtype;
begin
  if (select auth.uid()) is null or not public.has_tenant_permission(p_tenant_id, 'catalog.manage') then
    raise exception 'Catalog management permission required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id and status = 'active') then
    raise exception 'Active tenant required' using errcode = '42501';
  end if;
  if p_name is null or p_name <> btrim(p_name) or char_length(p_name) not between 2 and 120 then
    raise exception 'Invalid supplier name' using errcode = '22023';
  end if;
  if coalesce(p_lead_time_days, 7) not between 0 and 365 then
    raise exception 'Invalid lead time' using errcode = '22023';
  end if;

  if p_supplier_id is null then
    insert into public.suppliers(
      tenant_id, name, contact, phone, email, city, lead_time_days, notes, active
    ) values (
      p_tenant_id, p_name, nullif(btrim(p_contact), ''), nullif(btrim(p_phone), ''),
      nullif(btrim(p_email), ''), nullif(btrim(p_city), ''), coalesce(p_lead_time_days, 7),
      nullif(btrim(p_notes), ''), coalesce(p_active, true)
    ) returning * into saved;
  else
    update public.suppliers
    set name = p_name,
        contact = nullif(btrim(p_contact), ''),
        phone = nullif(btrim(p_phone), ''),
        email = nullif(btrim(p_email), ''),
        city = nullif(btrim(p_city), ''),
        lead_time_days = coalesce(p_lead_time_days, lead_time_days),
        notes = nullif(btrim(p_notes), ''),
        active = coalesce(p_active, active)
    where tenant_id = p_tenant_id and id = p_supplier_id
    returning * into saved;
    if not found then
      raise exception 'Supplier not found' using errcode = '22023';
    end if;
  end if;

  return saved;
end;
$function$;

create or replace function public.delete_supplier(p_tenant_id uuid, p_supplier_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if (select auth.uid()) is null or not public.has_tenant_permission(p_tenant_id, 'catalog.manage') then
    raise exception 'Catalog management permission required' using errcode = '42501';
  end if;

  update public.products
  set supplier_id = null
  where tenant_id = p_tenant_id and supplier_id = p_supplier_id;

  delete from public.suppliers where tenant_id = p_tenant_id and id = p_supplier_id;
  if not found then
    raise exception 'Supplier not found' using errcode = '22023';
  end if;
end;
$function$;

create or replace function public.delete_product(p_tenant_id uuid, p_product_id uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_has_movements boolean;
  v_variant_ids uuid[];
begin
  if (select auth.uid()) is null or not public.has_tenant_permission(p_tenant_id, 'catalog.manage') then
    raise exception 'Catalog management permission required' using errcode = '42501';
  end if;

  select coalesce(array_agg(id), '{}') into v_variant_ids
  from public.product_variants
  where tenant_id = p_tenant_id and product_id = p_product_id;

  if cardinality(v_variant_ids) = 0 then
    raise exception 'Product not found' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.stock_movements
    where tenant_id = p_tenant_id and variant_id = any(v_variant_ids)
  ) into v_has_movements;

  if v_has_movements then
    update public.products set active = false where tenant_id = p_tenant_id and id = p_product_id;
    update public.product_variants set active = false where tenant_id = p_tenant_id and product_id = p_product_id;
    return 'archived';
  end if;

  delete from public.stock_balances where tenant_id = p_tenant_id and variant_id = any(v_variant_ids);
  delete from public.product_variants where tenant_id = p_tenant_id and product_id = p_product_id;
  delete from public.products where tenant_id = p_tenant_id and id = p_product_id;
  return 'deleted';
end;
$function$;

revoke all on function public.save_supplier(uuid, uuid, text, text, text, text, text, integer, text, boolean) from public;
revoke all on function public.delete_supplier(uuid, uuid) from public;
revoke all on function public.delete_product(uuid, uuid) from public;
grant execute on function public.save_supplier(uuid, uuid, text, text, text, text, text, integer, text, boolean) to authenticated;
grant execute on function public.delete_supplier(uuid, uuid) to authenticated;
grant execute on function public.delete_product(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- 7. Réglages entreprise
alter table public.tenants
  add column if not exists address text,
  add column if not exists phone text;

create or replace function public.update_tenant_settings(
  p_tenant_id uuid,
  p_name text,
  p_currency_code text,
  p_timezone text,
  p_address text default null,
  p_phone text default null
)
returns public.tenants
language plpgsql
security definer
set search_path to ''
as $function$
declare
  saved public.tenants%rowtype;
begin
  if (select auth.uid()) is null or not public.has_tenant_permission(p_tenant_id, 'tenant.manage') then
    raise exception 'Tenant management permission required' using errcode = '42501';
  end if;
  if p_name is null or p_name <> btrim(p_name) or char_length(p_name) not between 2 and 120 then
    raise exception 'Invalid tenant name' using errcode = '22023';
  end if;
  if p_currency_code is null or p_currency_code !~ '^[A-Z]{3}$' then
    raise exception 'Invalid currency' using errcode = '22023';
  end if;
  if p_timezone is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Invalid timezone' using errcode = '22023';
  end if;

  update public.tenants
  set name = p_name,
      currency_code = p_currency_code,
      timezone = p_timezone,
      address = nullif(btrim(p_address), ''),
      phone = nullif(btrim(p_phone), '')
  where id = p_tenant_id
  returning * into saved;

  if not found then
    raise exception 'Tenant not found' using errcode = '22023';
  end if;
  return saved;
end;
$function$;

revoke all on function public.update_tenant_settings(uuid, text, text, text, text, text) from public;
grant execute on function public.update_tenant_settings(uuid, text, text, text, text, text) to authenticated;

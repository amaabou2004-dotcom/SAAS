begin;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_tenant_id_id_unique unique (tenant_id, id),
  constraint categories_name_valid check (name = btrim(name) and char_length(name) between 2 and 120)
);
create unique index categories_tenant_name_unique on public.categories (tenant_id, lower(name));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category_id uuid,
  name text not null,
  description text,
  sale_price numeric(19, 4) not null,
  cost_price numeric(19, 4) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_tenant_id_id_unique unique (tenant_id, id),
  constraint products_category_same_tenant foreign key (tenant_id, category_id)
    references public.categories(tenant_id, id) on delete restrict,
  constraint products_name_valid check (name = btrim(name) and char_length(name) between 2 and 160),
  constraint products_description_valid check (description is null or char_length(description) <= 5000),
  constraint products_sale_price_nonnegative check (sale_price >= 0),
  constraint products_cost_price_nonnegative check (cost_price >= 0)
);
create index products_tenant_category_idx on public.products (tenant_id, category_id);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null,
  sku text not null,
  barcode text,
  attributes jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_tenant_id_id_unique unique (tenant_id, id),
  constraint product_variants_product_same_tenant foreign key (tenant_id, product_id)
    references public.products(tenant_id, id) on delete restrict,
  constraint product_variants_sku_unique unique (tenant_id, sku),
  constraint product_variants_sku_valid check (
    sku = upper(btrim(sku)) and sku ~ '^[A-Z0-9][A-Z0-9._-]{0,79}$'
  ),
  constraint product_variants_barcode_valid check (
    barcode is null or (barcode = btrim(barcode) and char_length(barcode) between 1 and 80)
  ),
  constraint product_variants_attributes_object check (jsonb_typeof(attributes) = 'object')
);
create unique index product_variants_tenant_barcode_unique
  on public.product_variants (tenant_id, barcode) where barcode is not null;
create index product_variants_tenant_product_idx on public.product_variants (tenant_id, product_id);

create table public.stock_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  code text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_locations_tenant_id_id_unique unique (tenant_id, id),
  constraint stock_locations_tenant_code_unique unique (tenant_id, code),
  constraint stock_locations_name_valid check (name = btrim(name) and char_length(name) between 2 and 120),
  constraint stock_locations_code_valid check (
    code = upper(btrim(code)) and code ~ '^[A-Z0-9][A-Z0-9_-]{0,19}$'
  )
);

create table public.stock_balances (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  variant_id uuid not null,
  location_id uuid not null,
  on_hand numeric(19, 4) not null default 0,
  reserved numeric(19, 4) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, variant_id, location_id),
  constraint stock_balances_variant_same_tenant foreign key (tenant_id, variant_id)
    references public.product_variants(tenant_id, id) on delete restrict,
  constraint stock_balances_location_same_tenant foreign key (tenant_id, location_id)
    references public.stock_locations(tenant_id, id) on delete restrict,
  constraint stock_balances_on_hand_nonnegative check (on_hand >= 0),
  constraint stock_balances_reserved_valid check (reserved >= 0 and reserved <= on_hand)
);

create table public.stock_operations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_type text not null,
  status text not null default 'posted',
  idempotency_key text not null,
  request_fingerprint text not null,
  actor_user_id uuid not null,
  reason text,
  reference text,
  reverses_operation_id uuid,
  created_at timestamptz not null default now(),
  constraint stock_operations_tenant_id_id_unique unique (tenant_id, id),
  constraint stock_operations_tenant_key_unique unique (tenant_id, idempotency_key),
  constraint stock_operations_reversal_same_tenant foreign key (tenant_id, reverses_operation_id)
    references public.stock_operations(tenant_id, id) on delete restrict,
  constraint stock_operations_type_valid check (
    operation_type in ('opening', 'receipt', 'adjustment', 'transfer', 'reversal')
  ),
  constraint stock_operations_status_valid check (status in ('posted', 'reversed')),
  constraint stock_operations_key_valid check (
    idempotency_key = btrim(idempotency_key) and char_length(idempotency_key) between 8 and 100
  ),
  constraint stock_operations_reason_valid check (reason is null or char_length(btrim(reason)) between 2 and 500),
  constraint stock_operations_reference_valid check (reference is null or char_length(reference) <= 120),
  constraint stock_operations_reversal_valid check (
    (operation_type = 'reversal' and reverses_operation_id is not null)
    or (operation_type <> 'reversal' and reverses_operation_id is null)
  )
);
create unique index stock_operations_one_reversal_unique
  on public.stock_operations (tenant_id, reverses_operation_id)
  where reverses_operation_id is not null;
create index stock_operations_tenant_created_idx on public.stock_operations (tenant_id, created_at desc);

comment on column public.stock_operations.actor_user_id is
  'Auth user identifier retained as an audit identifier, without a cascading foreign key.';

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null,
  variant_id uuid not null,
  location_id uuid not null,
  quantity_delta numeric(19, 4) not null,
  on_hand_after numeric(19, 4) not null,
  reserved_after numeric(19, 4) not null,
  created_at timestamptz not null default now(),
  constraint stock_movements_operation_variant_location_unique unique (operation_id, variant_id, location_id),
  constraint stock_movements_operation_same_tenant foreign key (tenant_id, operation_id)
    references public.stock_operations(tenant_id, id) on delete restrict,
  constraint stock_movements_variant_same_tenant foreign key (tenant_id, variant_id)
    references public.product_variants(tenant_id, id) on delete restrict,
  constraint stock_movements_location_same_tenant foreign key (tenant_id, location_id)
    references public.stock_locations(tenant_id, id) on delete restrict,
  constraint stock_movements_quantity_nonzero check (quantity_delta <> 0),
  constraint stock_movements_balance_after_valid check (
    on_hand_after >= 0 and reserved_after >= 0 and reserved_after <= on_hand_after
  )
);
create index stock_movements_tenant_created_idx on public.stock_movements (tenant_id, created_at desc);
create index stock_movements_tenant_variant_idx on public.stock_movements (tenant_id, variant_id);

create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger product_variants_set_updated_at before update on public.product_variants
for each row execute function public.set_updated_at();
create trigger stock_locations_set_updated_at before update on public.stock_locations
for each row execute function public.set_updated_at();
create trigger stock_balances_set_updated_at before update on public.stock_balances
for each row execute function public.set_updated_at();

create or replace function public.create_default_stock_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stock_locations(tenant_id, name, code)
  values (new.id, 'Dépôt principal', 'PRINCIPAL');
  return new;
end;
$$;

insert into public.stock_locations(tenant_id, name, code)
select tenant.id, 'Dépôt principal', 'PRINCIPAL'
from public.tenants as tenant
on conflict (tenant_id, code) do nothing;

create trigger tenants_create_default_stock_location
after insert on public.tenants
for each row execute function public.create_default_stock_location();

create or replace function public.upsert_category(
  p_tenant_id uuid,
  p_category_id uuid,
  p_name text,
  p_active boolean
)
returns public.categories
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_category public.categories%rowtype;
begin
  if (select auth.uid()) is null
    or not public.has_tenant_permission(p_tenant_id, 'catalog.manage') then
    raise exception 'Catalog management permission required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id and status = 'active') then
    raise exception 'Active tenant required' using errcode = '42501';
  end if;
  if p_name is null or p_name <> btrim(p_name) or char_length(p_name) not between 2 and 120 then
    raise exception 'Invalid category name' using errcode = '22023';
  end if;
  if p_active is null then
    raise exception 'Invalid category status' using errcode = '22023';
  end if;

  if p_category_id is null then
    insert into public.categories(tenant_id, name, active)
    values (p_tenant_id, p_name, p_active)
    returning * into saved_category;
  else
    update public.categories
    set name = p_name, active = p_active
    where tenant_id = p_tenant_id and id = p_category_id
    returning * into saved_category;
    if not found then
      raise exception 'Category not found' using errcode = '22023';
    end if;
  end if;

  return saved_category;
end;
$$;

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
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_product public.products%rowtype;
  saved_variant public.product_variants%rowtype;
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
  if p_barcode is not null and (
    p_barcode <> btrim(p_barcode) or char_length(p_barcode) not between 1 and 80
  ) then
    raise exception 'Invalid barcode' using errcode = '22023';
  end if;
  if p_attributes is null or jsonb_typeof(p_attributes) <> 'object' or p_active is null then
    raise exception 'Invalid variant data' using errcode = '22023';
  end if;
  if p_category_id is not null and not exists (
    select 1 from public.categories where tenant_id = p_tenant_id and id = p_category_id
  ) then
    raise exception 'Category not found' using errcode = '22023';
  end if;

  if p_product_id is null then
    if p_variant_id is not null then
      raise exception 'Unexpected variant identifier' using errcode = '22023';
    end if;
    insert into public.products(
      tenant_id, category_id, name, description, sale_price, cost_price, active
    ) values (
      p_tenant_id, p_category_id, p_name, nullif(p_description, ''), p_sale_price, p_cost_price, p_active
    ) returning * into saved_product;

    insert into public.product_variants(
      tenant_id, product_id, sku, barcode, attributes, active
    ) values (
      p_tenant_id, saved_product.id, p_sku, nullif(p_barcode, ''), p_attributes, p_active
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
        active = p_active
    where tenant_id = p_tenant_id and id = p_product_id
    returning * into saved_product;
    if not found then
      raise exception 'Product not found' using errcode = '22023';
    end if;

    update public.product_variants
    set sku = p_sku,
        barcode = nullif(p_barcode, ''),
        attributes = p_attributes,
        active = p_active
    where tenant_id = p_tenant_id and id = p_variant_id and product_id = p_product_id
    returning * into saved_variant;
    if not found then
      raise exception 'Variant not found' using errcode = '22023';
    end if;
  end if;

  return jsonb_build_object('product', to_jsonb(saved_product), 'variant', to_jsonb(saved_variant));
end;
$$;

create or replace function public.upsert_stock_location(
  p_tenant_id uuid,
  p_location_id uuid,
  p_name text,
  p_code text,
  p_active boolean
)
returns public.stock_locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_location public.stock_locations%rowtype;
begin
  if (select auth.uid()) is null
    or not public.has_tenant_permission(p_tenant_id, 'inventory.manage') then
    raise exception 'Inventory management permission required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id and status = 'active') then
    raise exception 'Active tenant required' using errcode = '42501';
  end if;
  if p_name is null or p_name <> btrim(p_name) or char_length(p_name) not between 2 and 120 then
    raise exception 'Invalid location name' using errcode = '22023';
  end if;
  if p_code is null or p_code <> upper(btrim(p_code)) or p_code !~ '^[A-Z0-9][A-Z0-9_-]{0,19}$' then
    raise exception 'Invalid location code' using errcode = '22023';
  end if;
  if p_active is null then
    raise exception 'Invalid location status' using errcode = '22023';
  end if;

  if p_location_id is null then
    insert into public.stock_locations(tenant_id, name, code, active)
    values (p_tenant_id, p_name, p_code, p_active)
    returning * into saved_location;
  else
    update public.stock_locations
    set name = p_name, code = p_code, active = p_active
    where tenant_id = p_tenant_id and id = p_location_id
    returning * into saved_location;
    if not found then
      raise exception 'Location not found' using errcode = '22023';
    end if;
  end if;

  return saved_location;
end;
$$;

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
set search_path = ''
as $$
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
  if p_operation_type not in ('opening', 'receipt', 'adjustment', 'transfer', 'reversal') then
    raise exception 'Invalid stock operation type' using errcode = '22023';
  end if;
  if p_idempotency_key is null or p_idempotency_key <> btrim(p_idempotency_key)
    or char_length(p_idempotency_key) not between 8 and 100 then
    raise exception 'Invalid idempotency key' using errcode = '22023';
  end if;
  if p_reason is not null and char_length(btrim(p_reason)) not between 2 and 500 then
    raise exception 'Invalid operation reason' using errcode = '22023';
  end if;
  if p_operation_type in ('adjustment', 'reversal')
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
  if exists (
    select 1 from jsonb_array_elements(v_lines) as element
    where jsonb_typeof(element) <> 'object'
  ) then
    raise exception 'Invalid stock line' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_lines) as element
    where not (element ?& array['variant_id', 'location_id', 'quantity_delta'])
       or (select count(*) from jsonb_object_keys(element)) <> 3
  ) then
    raise exception 'Invalid stock line fields' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(v_lines) as line(variant_id uuid, location_id uuid, quantity_delta numeric)
    where line.variant_id is null or line.location_id is null
       or line.quantity_delta is null or line.quantity_delta = 0
       or line.quantity_delta <> round(line.quantity_delta, 4)
  ) then
    raise exception 'Invalid stock quantity' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(v_lines) as line(variant_id uuid, location_id uuid, quantity_delta numeric)
    group by line.variant_id, line.location_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate stock line' using errcode = '22023';
  end if;
  if p_operation_type in ('opening', 'receipt') and exists (
    select 1
    from jsonb_to_recordset(v_lines) as line(variant_id uuid, location_id uuid, quantity_delta numeric)
    where line.quantity_delta <= 0
  ) then
    raise exception 'Incoming quantities must be positive' using errcode = '22023';
  end if;
  if p_operation_type = 'transfer' and (
    jsonb_array_length(v_lines) < 2 or exists (
      select 1
      from jsonb_to_recordset(v_lines) as line(variant_id uuid, location_id uuid, quantity_delta numeric)
      group by line.variant_id
      having count(*) < 2 or sum(line.quantity_delta) <> 0
    )
  ) then
    raise exception 'Transfer must balance each variant across locations' using errcode = '22023';
  end if;

  insert into public.stock_operations(
    tenant_id,
    operation_type,
    idempotency_key,
    request_fingerprint,
    actor_user_id,
    reason,
    reference,
    reverses_operation_id
  ) values (
    p_tenant_id,
    p_operation_type,
    p_idempotency_key,
    v_fingerprint,
    current_user_id,
    nullif(btrim(p_reason), ''),
    nullif(btrim(p_reference), ''),
    p_reverses_operation_id
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
    where tenant_id = p_tenant_id
      and variant_id = v_line.variant_id
      and location_id = v_line.location_id
    for update;

    v_new_on_hand := v_on_hand + v_line.quantity_delta;
    if v_new_on_hand < 0 or v_new_on_hand < v_reserved then
      raise exception 'Insufficient available stock' using errcode = 'P0001';
    end if;

    update public.stock_balances
    set on_hand = v_new_on_hand
    where tenant_id = p_tenant_id
      and variant_id = v_line.variant_id
      and location_id = v_line.location_id;

    insert into public.stock_movements(
      tenant_id,
      operation_id,
      variant_id,
      location_id,
      quantity_delta,
      on_hand_after,
      reserved_after
    ) values (
      p_tenant_id,
      v_operation_id,
      v_line.variant_id,
      v_line.location_id,
      v_line.quantity_delta,
      v_new_on_hand,
      v_reserved
    );
  end loop;

  if p_operation_type = 'reversal' then
    update public.stock_operations
    set status = 'reversed'
    where tenant_id = p_tenant_id and id = p_reverses_operation_id;
  end if;

  return v_operation_id;
end;
$$;

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.stock_locations enable row level security;
alter table public.stock_balances enable row level security;
alter table public.stock_operations enable row level security;
alter table public.stock_movements enable row level security;

create policy categories_read_permission on public.categories
for select to authenticated
using (
  public.has_tenant_permission(tenant_id, 'catalog.read')
  or public.has_tenant_permission(tenant_id, 'inventory.read')
);
create policy products_read_permission on public.products
for select to authenticated
using (
  public.has_tenant_permission(tenant_id, 'catalog.read')
  or public.has_tenant_permission(tenant_id, 'inventory.read')
);
create policy product_variants_read_permission on public.product_variants
for select to authenticated
using (
  public.has_tenant_permission(tenant_id, 'catalog.read')
  or public.has_tenant_permission(tenant_id, 'inventory.read')
);
create policy stock_locations_read_permission on public.stock_locations
for select to authenticated
using (public.has_tenant_permission(tenant_id, 'inventory.read'));
create policy stock_balances_read_permission on public.stock_balances
for select to authenticated
using (public.has_tenant_permission(tenant_id, 'inventory.read'));
create policy stock_operations_read_permission on public.stock_operations
for select to authenticated
using (public.has_tenant_permission(tenant_id, 'inventory.read'));
create policy stock_movements_read_permission on public.stock_movements
for select to authenticated
using (public.has_tenant_permission(tenant_id, 'inventory.read'));

create or replace view public.stock_overview
with (security_invoker = true) as
select
  balance.tenant_id,
  balance.variant_id,
  balance.location_id,
  product.id as product_id,
  product.name as product_name,
  variant.sku,
  location.name as location_name,
  location.code as location_code,
  balance.on_hand,
  balance.reserved,
  balance.on_hand - balance.reserved as available,
  balance.updated_at
from public.stock_balances as balance
join public.product_variants as variant
  on variant.tenant_id = balance.tenant_id and variant.id = balance.variant_id
join public.products as product
  on product.tenant_id = variant.tenant_id and product.id = variant.product_id
join public.stock_locations as location
  on location.tenant_id = balance.tenant_id and location.id = balance.location_id;

create or replace view public.stock_movement_history
with (security_invoker = true) as
select
  movement.id,
  movement.tenant_id,
  movement.operation_id,
  operation.operation_type,
  operation.status as operation_status,
  operation.actor_user_id,
  operation.reason,
  operation.reference,
  operation.reverses_operation_id,
  movement.variant_id,
  movement.location_id,
  product.id as product_id,
  product.name as product_name,
  variant.sku,
  location.name as location_name,
  location.code as location_code,
  movement.quantity_delta,
  movement.on_hand_after,
  movement.reserved_after,
  movement.created_at
from public.stock_movements as movement
join public.stock_operations as operation
  on operation.tenant_id = movement.tenant_id and operation.id = movement.operation_id
join public.product_variants as variant
  on variant.tenant_id = movement.tenant_id and variant.id = movement.variant_id
join public.products as product
  on product.tenant_id = variant.tenant_id and product.id = variant.product_id
join public.stock_locations as location
  on location.tenant_id = movement.tenant_id and location.id = movement.location_id;

revoke all on table public.categories from anon, authenticated;
revoke all on table public.products from anon, authenticated;
revoke all on table public.product_variants from anon, authenticated;
revoke all on table public.stock_locations from anon, authenticated;
revoke all on table public.stock_balances from anon, authenticated;
revoke all on table public.stock_operations from anon, authenticated;
revoke all on table public.stock_movements from anon, authenticated;
revoke all on table public.stock_overview from anon, authenticated;
revoke all on table public.stock_movement_history from anon, authenticated;

grant select on table public.categories to authenticated;
grant select on table public.products to authenticated;
grant select on table public.product_variants to authenticated;
grant select on table public.stock_locations to authenticated;
grant select on table public.stock_balances to authenticated;
grant select on table public.stock_operations to authenticated;
grant select on table public.stock_movements to authenticated;
grant select on table public.stock_overview to authenticated;
grant select on table public.stock_movement_history to authenticated;

revoke all on function public.create_default_stock_location() from public;
revoke all on function public.upsert_category(uuid, uuid, text, boolean) from public;
revoke all on function public.upsert_product(uuid, uuid, uuid, uuid, text, text, numeric, numeric, text, text, jsonb, boolean) from public;
revoke all on function public.upsert_stock_location(uuid, uuid, text, text, boolean) from public;
revoke all on function public.post_stock_operation(uuid, text, text, text, text, jsonb, uuid) from public;

grant execute on function public.upsert_category(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.upsert_product(uuid, uuid, uuid, uuid, text, text, numeric, numeric, text, text, jsonb, boolean) to authenticated;
grant execute on function public.upsert_stock_location(uuid, uuid, text, text, boolean) to authenticated;
grant execute on function public.post_stock_operation(uuid, text, text, text, text, jsonb, uuid) to authenticated;

commit;

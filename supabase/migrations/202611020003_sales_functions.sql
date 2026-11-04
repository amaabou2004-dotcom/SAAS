-- Ventes : création et annulation transactionnelles.
--
-- `post_sale` écrit la vente, ses lignes et la sortie de stock dans une seule
-- transaction. `void_sale` ne supprime rien : elle contre-passe l'opération de
-- stock et marque la vente annulée.

begin;

create or replace function public.post_sale(
  p_tenant_id uuid,
  p_idempotency_key text,
  p_location_id uuid,
  p_payment_method text,
  p_payment_reference text default null,
  p_customer_name text default null,
  p_note text default null,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
  v_fingerprint text;
  v_existing_id uuid;
  v_existing_fingerprint text;
  v_sale_id uuid;
  v_seq bigint;
  v_number text;
  v_operation_id uuid;
  v_subtotal numeric(19, 4);
  v_cost numeric(19, 4);
  v_lines integer;
  v_resolved integer;
  v_item record;
  v_on_hand numeric(19, 4);
  v_reserved numeric(19, 4);
  v_new_on_hand numeric(19, 4);
begin
  if v_user_id is null
    or not public.has_tenant_permission(p_tenant_id, 'sales.manage') then
    raise exception 'Sales management permission required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id and status = 'active') then
    raise exception 'Active tenant required' using errcode = '42501';
  end if;
  if p_idempotency_key is null or p_idempotency_key <> btrim(p_idempotency_key)
    or char_length(p_idempotency_key) not between 8 and 100 then
    raise exception 'Invalid idempotency key' using errcode = '22023';
  end if;
  if p_payment_method is null or p_payment_method not in ('cash', 'mobile_money', 'credit') then
    raise exception 'Invalid payment method' using errcode = '22023';
  end if;
  if p_payment_method = 'mobile_money'
    and (p_payment_reference is null or char_length(btrim(p_payment_reference)) < 4) then
    raise exception 'A payment reference is required for mobile money' using errcode = '22023';
  end if;
  if p_payment_reference is not null and char_length(btrim(p_payment_reference)) > 120 then
    raise exception 'Invalid payment reference' using errcode = '22023';
  end if;
  if p_customer_name is not null and char_length(btrim(p_customer_name)) not between 2 and 120 then
    raise exception 'Invalid customer name' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Invalid sale note' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.stock_locations as location
    where location.tenant_id = p_tenant_id and location.id = p_location_id and location.active
  ) then
    raise exception 'Unknown stock location' using errcode = '22023';
  end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'A sale requires at least one item' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_items) as element
    where jsonb_typeof(element) <> 'object'
       or not (element ? 'variant_id')
       or not (element ? 'quantity')
  ) then
    raise exception 'Invalid sale item' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(v_items) as item(variant_id uuid, quantity numeric, unit_price numeric)
    where item.variant_id is null
       or item.quantity is null or item.quantity <= 0
       or item.quantity <> round(item.quantity, 4)
       or (item.unit_price is not null and item.unit_price < 0)
  ) then
    raise exception 'Invalid sale quantity or price' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(v_items) as item(variant_id uuid, quantity numeric, unit_price numeric)
    group by item.variant_id having count(*) > 1
  ) then
    raise exception 'Duplicate sale item' using errcode = '22023';
  end if;

  v_fingerprint := encode(extensions.digest(
    jsonb_build_object(
      'location', p_location_id,
      'payment', p_payment_method,
      'reference', nullif(btrim(coalesce(p_payment_reference, '')), ''),
      'customer', nullif(btrim(coalesce(p_customer_name, '')), ''),
      'note', nullif(btrim(coalesce(p_note, '')), ''),
      'items', v_items
    )::text,
    'sha256'
  ), 'hex');

  select id, request_fingerprint into v_existing_id, v_existing_fingerprint
  from public.sales
  where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_fingerprint <> v_fingerprint then
      raise exception 'Idempotency key payload mismatch' using errcode = '22023';
    end if;
    return v_existing_id;
  end if;

  -- Résolution des lignes : produit actif et variante active obligatoires.
  select count(*) into v_lines
  from jsonb_to_recordset(v_items) as item(variant_id uuid, quantity numeric, unit_price numeric);

  select count(*) into v_resolved
  from jsonb_to_recordset(v_items) as item(variant_id uuid, quantity numeric, unit_price numeric)
  join public.product_variants as variant
    on variant.tenant_id = p_tenant_id and variant.id = item.variant_id
  join public.products as product
    on product.tenant_id = variant.tenant_id and product.id = variant.product_id
  where product.active and variant.active;

  if v_resolved <> v_lines then
    raise exception 'Unknown or inactive sale item' using errcode = '22023';
  end if;

  select
    coalesce(sum(round(coalesce(item.unit_price, product.sale_price) * item.quantity, 4)), 0),
    coalesce(sum(round(product.cost_price * item.quantity, 4)), 0)
  into v_subtotal, v_cost
  from jsonb_to_recordset(v_items) as item(variant_id uuid, quantity numeric, unit_price numeric)
  join public.product_variants as variant
    on variant.tenant_id = p_tenant_id and variant.id = item.variant_id
  join public.products as product
    on product.tenant_id = variant.tenant_id and product.id = variant.product_id;

  insert into public.sales(
    tenant_id,
    location_id,
    payment_method,
    payment_reference,
    customer_name,
    note,
    subtotal,
    total,
    total_cost,
    item_count,
    idempotency_key,
    request_fingerprint,
    actor_user_id
  ) values (
    p_tenant_id,
    p_location_id,
    p_payment_method,
    nullif(btrim(coalesce(p_payment_reference, '')), ''),
    nullif(btrim(coalesce(p_customer_name, '')), ''),
    nullif(btrim(coalesce(p_note, '')), ''),
    v_subtotal,
    v_subtotal,
    v_cost,
    v_lines,
    p_idempotency_key,
    v_fingerprint,
    v_user_id
  )
  on conflict (tenant_id, idempotency_key) do nothing
  returning id, seq into v_sale_id, v_seq;

  if v_sale_id is null then
    select id, request_fingerprint into v_existing_id, v_existing_fingerprint
    from public.sales
    where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
    if v_existing_fingerprint <> v_fingerprint then
      raise exception 'Idempotency key payload mismatch' using errcode = '22023';
    end if;
    return v_existing_id;
  end if;

  v_number := 'VTE-' || lpad(v_seq::text, 6, '0');

  insert into public.sale_items(
    tenant_id,
    sale_id,
    variant_id,
    product_name,
    sku,
    unit_price,
    unit_cost,
    quantity,
    line_total
  )
  select
    p_tenant_id,
    v_sale_id,
    variant.id,
    product.name,
    variant.sku,
    round(coalesce(item.unit_price, product.sale_price), 4),
    round(product.cost_price, 4),
    item.quantity,
    round(coalesce(item.unit_price, product.sale_price) * item.quantity, 4)
  from jsonb_to_recordset(v_items) as item(variant_id uuid, quantity numeric, unit_price numeric)
  join public.product_variants as variant
    on variant.tenant_id = p_tenant_id and variant.id = item.variant_id
  join public.products as product
    on product.tenant_id = variant.tenant_id and product.id = variant.product_id;

  -- Sortie de stock de la vente.
  --
  -- Elle est écrite ici, et non via `post_stock_operation`, parce que vendre relève
  -- du droit `sales.manage` : un vendeur doit pouvoir encaisser sans disposer de
  -- `inventory.manage` (qui reste requis pour les mouvements manuels). Les
  -- garanties sont identiques : verrouillage du solde, refus si insuffisant,
  -- opération tracée et réversible par contre-passation.
  insert into public.stock_operations(
    tenant_id,
    operation_type,
    idempotency_key,
    request_fingerprint,
    actor_user_id,
    reason,
    reference
  ) values (
    p_tenant_id,
    'issue',
    left(p_idempotency_key || ':stock', 100),
    v_fingerprint,
    v_user_id,
    'Vente ' || v_number,
    v_number
  )
  returning id into v_operation_id;

  for v_item in
    select item.variant_id, item.quantity
    from jsonb_to_recordset(v_items) as item(variant_id uuid, quantity numeric, unit_price numeric)
    order by item.variant_id
  loop
    insert into public.stock_balances(tenant_id, variant_id, location_id, on_hand, reserved)
    values (p_tenant_id, v_item.variant_id, p_location_id, 0, 0)
    on conflict (tenant_id, variant_id, location_id) do nothing;

    select on_hand, reserved into v_on_hand, v_reserved
    from public.stock_balances
    where tenant_id = p_tenant_id
      and variant_id = v_item.variant_id
      and location_id = p_location_id
    for update;

    v_new_on_hand := v_on_hand - v_item.quantity;
    if v_new_on_hand < 0 or v_new_on_hand < v_reserved then
      raise exception 'Insufficient available stock' using errcode = 'P0001';
    end if;

    update public.stock_balances
    set on_hand = v_new_on_hand
    where tenant_id = p_tenant_id
      and variant_id = v_item.variant_id
      and location_id = p_location_id;

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
      v_item.variant_id,
      p_location_id,
      -v_item.quantity,
      v_new_on_hand,
      v_reserved
    );
  end loop;

  update public.sales
  set operation_id = v_operation_id
  where tenant_id = p_tenant_id and id = v_sale_id;

  return v_sale_id;
end;
$$;

create or replace function public.void_sale(
  p_tenant_id uuid,
  p_sale_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_sale public.sales%rowtype;
  v_number text;
  v_operation_id uuid;
begin
  -- Annuler une vente remet du stock : il faut aussi le droit d'inventaire.
  if v_user_id is null or not public.has_tenant_permission(p_tenant_id, 'sales.manage') then
    raise exception 'Sales management permission required' using errcode = '42501';
  end if;
  if not public.has_tenant_permission(p_tenant_id, 'inventory.manage') then
    raise exception 'Inventory management permission required to void a sale' using errcode = '42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 2 and 400 then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  if p_idempotency_key is null or p_idempotency_key <> btrim(p_idempotency_key)
    or char_length(p_idempotency_key) not between 8 and 100 then
    raise exception 'Invalid idempotency key' using errcode = '22023';
  end if;

  select * into v_sale
  from public.sales
  where tenant_id = p_tenant_id and id = p_sale_id
  for update;

  if not found then
    raise exception 'Sale not found' using errcode = 'P0002';
  end if;
  if v_sale.status <> 'completed' then
    raise exception 'Sale is already voided' using errcode = '22023';
  end if;
  if v_sale.operation_id is null then
    raise exception 'Sale has no stock operation to reverse' using errcode = '22023';
  end if;

  v_number := 'VTE-' || lpad(v_sale.seq::text, 6, '0');

  v_operation_id := public.post_stock_operation(
    p_tenant_id,
    'reversal',
    left(p_idempotency_key || ':void', 100),
    left('Annulation ' || v_number || ' — ' || btrim(p_reason), 500),
    v_number,
    '[]'::jsonb,
    v_sale.operation_id
  );

  update public.sales
  set status = 'voided',
      voided_at = now(),
      reversal_operation_id = v_operation_id
  where tenant_id = p_tenant_id and id = p_sale_id;

  return v_operation_id;
end;
$$;

revoke all on function public.post_sale(uuid, text, uuid, text, text, text, text, jsonb) from public, anon;
revoke all on function public.void_sale(uuid, uuid, text, text) from public, anon;
grant execute on function public.post_sale(uuid, text, uuid, text, text, text, text, jsonb) to authenticated;
grant execute on function public.void_sale(uuid, uuid, text, text) to authenticated;

commit;

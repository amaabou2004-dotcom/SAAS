-- Reserve idempotency before locking a reversal source operation.
-- This makes same-key retries return the committed operation under concurrency.

begin;

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

commit;

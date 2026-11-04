begin;

select plan(11);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('6f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', 'authenticated', 'authenticated', 'stock-a@example.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('6f5c6bd8-9b79-4b69-9b76-4b4b47b91a02', 'authenticated', 'authenticated', 'stock-b@example.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.tenants(id, name, slug) values
  ('8f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', 'Stock Tenant A', 'stock-tenant-a'),
  ('8f5c6bd8-9b79-4b69-9b76-4b4b47b91a02', 'Stock Tenant B', 'stock-tenant-b');
insert into public.roles(id, tenant_id, name, is_system) values
  ('9f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', '8f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', 'Propriétaire', true),
  ('9f5c6bd8-9b79-4b69-9b76-4b4b47b91a02', '8f5c6bd8-9b79-4b69-9b76-4b4b47b91a02', 'Propriétaire', true);
insert into public.memberships(tenant_id, user_id, role_id) values
  ('8f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', '6f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', '9f5c6bd8-9b79-4b69-9b76-4b4b47b91a01'),
  ('8f5c6bd8-9b79-4b69-9b76-4b4b47b91a02', '6f5c6bd8-9b79-4b69-9b76-4b4b47b91a02', '9f5c6bd8-9b79-4b69-9b76-4b4b47b91a02');
insert into public.role_permissions(tenant_id, role_id, permission_code)
select tenant.id, role.id, permission.code
from public.tenants as tenant
join public.roles as role on role.tenant_id = tenant.id
cross join public.permissions as permission
where tenant.slug in ('stock-tenant-a', 'stock-tenant-b');

insert into public.categories(id, tenant_id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '8f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', 'Catégorie A'),
  ('aaaaaaaa-0000-4000-8000-000000000002', '8f5c6bd8-9b79-4b69-9b76-4b4b47b91a02', 'Catégorie B');
insert into public.products(id, tenant_id, category_id, name, sale_price, cost_price) values
  ('aaaaaaaa-0000-4000-8000-000000000011', '8f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', 'aaaaaaaa-0000-4000-8000-000000000001', 'Produit A', 10, 5),
  ('aaaaaaaa-0000-4000-8000-000000000012', '8f5c6bd8-9b79-4b69-9b76-4b4b47b91a02', 'aaaaaaaa-0000-4000-8000-000000000002', 'Produit B', 10, 5);
insert into public.product_variants(id, tenant_id, product_id, sku) values
  ('aaaaaaaa-0000-4000-8000-000000000021', '8f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', 'aaaaaaaa-0000-4000-8000-000000000011', 'SKU-A'),
  ('aaaaaaaa-0000-4000-8000-000000000022', '8f5c6bd8-9b79-4b69-9b76-4b4b47b91a02', 'aaaaaaaa-0000-4000-8000-000000000012', 'SKU-B');
insert into public.stock_locations(id, tenant_id, name, code) values
  ('aaaaaaaa-0000-4000-8000-000000000031', '8f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', 'Emplacement A', 'TEST-A'),
  ('aaaaaaaa-0000-4000-8000-000000000032', '8f5c6bd8-9b79-4b69-9b76-4b4b47b91a02', 'Emplacement B', 'TEST-B');
insert into public.stock_operations(
  id, tenant_id, operation_type, idempotency_key, request_fingerprint, actor_user_id, reason
) values
  ('aaaaaaaa-0000-4000-8000-000000000041', '8f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', 'opening', 'fixture-opening-a', 'fixture-a', '6f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', 'Stock A'),
  ('aaaaaaaa-0000-4000-8000-000000000042', '8f5c6bd8-9b79-4b69-9b76-4b4b47b91a02', 'opening', 'fixture-opening-b', 'fixture-b', '6f5c6bd8-9b79-4b69-9b76-4b4b47b91a02', 'Stock B');
insert into public.stock_balances(tenant_id, variant_id, location_id, on_hand) values
  ('8f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', 'aaaaaaaa-0000-4000-8000-000000000021', 'aaaaaaaa-0000-4000-8000-000000000031', 5),
  ('8f5c6bd8-9b79-4b69-9b76-4b4b47b91a02', 'aaaaaaaa-0000-4000-8000-000000000022', 'aaaaaaaa-0000-4000-8000-000000000032', 7);
insert into public.stock_movements(
  id, tenant_id, operation_id, variant_id, location_id, quantity_delta, on_hand_after, reserved_after
) values
  ('aaaaaaaa-0000-4000-8000-000000000051', '8f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', 'aaaaaaaa-0000-4000-8000-000000000041', 'aaaaaaaa-0000-4000-8000-000000000021', 'aaaaaaaa-0000-4000-8000-000000000031', 5, 5, 0),
  ('aaaaaaaa-0000-4000-8000-000000000052', '8f5c6bd8-9b79-4b69-9b76-4b4b47b91a02', 'aaaaaaaa-0000-4000-8000-000000000042', 'aaaaaaaa-0000-4000-8000-000000000022', 'aaaaaaaa-0000-4000-8000-000000000032', 7, 7, 0);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"6f5c6bd8-9b79-4b69-9b76-4b4b47b91a01","role":"authenticated"}';

select results_eq(
  $$select sku from public.product_variants order by sku$$,
  $$values ('SKU-A')$$,
  'tenant A reads only its own variants'
);
select is_empty(
  $$select * from public.products where tenant_id = '8f5c6bd8-9b79-4b69-9b76-4b4b47b91a02'$$,
  'tenant A cannot read tenant B products even with a tenant filter'
);
select results_eq(
  $$select location_code from public.stock_overview order by location_code$$,
  $$values ('TEST-A')$$,
  'tenant A reads only its own stock overview'
);
select is_empty(
  $$select * from public.stock_overview where tenant_id = '8f5c6bd8-9b79-4b69-9b76-4b4b47b91a02'$$,
  'security-invoker stock view does not leak tenant B stock'
);
select results_eq(
  $$select sku from public.stock_movement_history order by sku$$,
  $$values ('SKU-A')$$,
  'tenant A reads only its own movement history'
);
select throws_ok(
  $$select public.upsert_category(
    '8f5c6bd8-9b79-4b69-9b76-4b4b47b91a02', null, 'Intrusion', true
  )$$,
  '42501',
  'Catalog management permission required',
  'tenant A cannot create a category for tenant B'
);
select throws_ok(
  $$select public.post_stock_operation(
    '8f5c6bd8-9b79-4b69-9b76-4b4b47b91a02',
    'adjustment',
    'intrusion-key-0001',
    'Intrusion',
    null,
    jsonb_build_array(jsonb_build_object(
      'variant_id', 'aaaaaaaa-0000-4000-8000-000000000022',
      'location_id', 'aaaaaaaa-0000-4000-8000-000000000032',
      'quantity_delta', 1
    )),
    null
  )$$,
  '42501',
  'Inventory management permission required',
  'tenant A cannot post stock for tenant B'
);
select throws_ok(
  $$insert into public.stock_balances(tenant_id, variant_id, location_id, on_hand)
    values ('8f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', 'aaaaaaaa-0000-4000-8000-000000000021', 'aaaaaaaa-0000-4000-8000-000000000031', 99)$$,
  '42501',
  null,
  'tenant A cannot insert a stock balance directly'
);

set local "request.jwt.claims" = '{"sub":"6f5c6bd8-9b79-4b69-9b76-4b4b47b91a02","role":"authenticated"}';
select results_eq(
  $$select sku from public.product_variants order by sku$$,
  $$values ('SKU-B')$$,
  'tenant B sees neither tenant A products nor variants'
);
select is_empty(
  $$select * from public.stock_movement_history where tenant_id = '8f5c6bd8-9b79-4b69-9b76-4b4b47b91a01'$$,
  'tenant B cannot read tenant A movement history'
);

reset role;
set local role anon;
set local "request.jwt.claims" = '{}';
select throws_ok(
  $$select * from public.stock_overview$$,
  '42501',
  null,
  'anonymous users have no stock view privilege'
);

select * from finish();
rollback;

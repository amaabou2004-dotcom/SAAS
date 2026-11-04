begin;

select plan(39);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '3f5c6bd8-9b79-4b69-9b76-4b4b47b91a01',
  'authenticated', 'authenticated', 'inventory-owner@example.test', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.tenants(id, name, slug) values
  ('4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', 'Commerce Stock', 'commerce-stock');
insert into public.roles(id, tenant_id, name, is_system) values
  ('5f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', 'Propriétaire', true);
insert into public.memberships(tenant_id, user_id, role_id) values (
  '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01',
  '3f5c6bd8-9b79-4b69-9b76-4b4b47b91a01',
  '5f5c6bd8-9b79-4b69-9b76-4b4b47b91a01'
);
insert into public.role_permissions(tenant_id, role_id, permission_code)
select '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01',
       '5f5c6bd8-9b79-4b69-9b76-4b4b47b91a01',
       code
from public.permissions;

select has_function(
  'public', 'post_stock_operation', array['uuid', 'text', 'text', 'text', 'text', 'jsonb', 'uuid'],
  'transactional stock posting function exists'
);
select has_view('public', 'stock_overview', 'stock overview view exists');
select has_view('public', 'stock_movement_history', 'stock movement history view exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.stock_balances'::regclass),
  'RLS protects stock balances'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.stock_movements'::regclass),
  'RLS protects stock movements'
);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"3f5c6bd8-9b79-4b69-9b76-4b4b47b91a01","role":"authenticated"}';

select results_eq(
  $$select count(*)::integer from public.stock_locations
    where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and code = 'PRINCIPAL'$$,
  $$values (1)$$,
  'tenant creation supplies one default stock location'
);
select lives_ok(
  $$select public.upsert_category(
    '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', null, 'Boissons', true
  )$$,
  'catalog manager creates a category through the controlled RPC'
);
select lives_ok(
  $$select public.upsert_product(
    '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01',
    null,
    null,
    (select id from public.categories where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and name = 'Boissons'),
    'Eau minérale',
    'Produit de test transactionnel',
    500,
    300,
    'EAU-001',
    null,
    '{}'::jsonb,
    true
  )$$,
  'catalog manager creates a product and its initial variant atomically'
);
select results_eq(
  $$select count(*)::integer from public.product_variants
    where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and sku = 'EAU-001'$$,
  $$values (1)$$,
  'exactly one initial variant is created'
);

select lives_ok(
  $$select public.post_stock_operation(
    '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01',
    'opening',
    'opening-key-0001',
    'Stock initial',
    'INIT-001',
    jsonb_build_array(jsonb_build_object(
      'variant_id', (select id from public.product_variants where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and sku = 'EAU-001'),
      'location_id', (select id from public.stock_locations where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and code = 'PRINCIPAL'),
      'quantity_delta', 10
    )),
    null
  )$$,
  'opening stock is posted through the transactional RPC'
);
select results_eq(
  $$select on_hand::integer from public.stock_balances
    where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01'
      and variant_id = (select id from public.product_variants where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and sku = 'EAU-001')
      and location_id = (select id from public.stock_locations where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and code = 'PRINCIPAL')$$,
  $$values (10)$$,
  'opening operation sets the expected physical stock'
);
select lives_ok(
  $$select public.post_stock_operation(
    '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01',
    'opening',
    'opening-key-0001',
    'Stock initial',
    'INIT-001',
    jsonb_build_array(jsonb_build_object(
      'variant_id', (select id from public.product_variants where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and sku = 'EAU-001'),
      'location_id', (select id from public.stock_locations where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and code = 'PRINCIPAL'),
      'quantity_delta', 10
    )),
    null
  )$$,
  'an identical retry returns successfully'
);
select results_eq(
  $$select count(*)::integer from public.stock_operations
    where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and idempotency_key = 'opening-key-0001'$$,
  $$values (1)$$,
  'an idempotent retry creates only one operation'
);
select results_eq(
  $$select on_hand::integer from public.stock_balances
    where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01'
      and variant_id = (select id from public.product_variants where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and sku = 'EAU-001')
      and location_id = (select id from public.stock_locations where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and code = 'PRINCIPAL')$$,
  $$values (10)$$,
  'an idempotent retry does not duplicate stock'
);
select throws_ok(
  $$select public.post_stock_operation(
    '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01',
    'adjustment',
    'negative-key-0001',
    'Retrait impossible',
    null,
    jsonb_build_array(jsonb_build_object(
      'variant_id', (select id from public.product_variants where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and sku = 'EAU-001'),
      'location_id', (select id from public.stock_locations where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and code = 'PRINCIPAL'),
      'quantity_delta', -20
    )),
    null
  )$$,
  'P0001',
  'Insufficient available stock',
  'stock RPC rejects insufficient available stock'
);
select lives_ok(
  $$select public.post_stock_operation(
    '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01',
    'adjustment',
    'adjustment-key-0001',
    'Correction après comptage',
    null,
    jsonb_build_array(jsonb_build_object(
      'variant_id', (select id from public.product_variants where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and sku = 'EAU-001'),
      'location_id', (select id from public.stock_locations where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and code = 'PRINCIPAL'),
      'quantity_delta', -4
    )),
    null
  )$$,
  'a justified adjustment is accepted'
);
select results_eq(
  $$select on_hand::integer from public.stock_balances
    where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01'
      and variant_id = (select id from public.product_variants where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and sku = 'EAU-001')
      and location_id = (select id from public.stock_locations where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and code = 'PRINCIPAL')$$,
  $$values (6)$$,
  'adjustment updates physical stock exactly once'
);
select lives_ok(
  $$select public.upsert_stock_location(
    '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', null, 'Réserve', 'RESERVE', true
  )$$,
  'inventory manager creates a second location'
);
select throws_ok(
  $$select public.post_stock_operation(
    '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01',
    'transfer',
    'bad-transfer-key-0001',
    'Transfert invalide',
    null,
    jsonb_build_array(
      jsonb_build_object(
        'variant_id', (select id from public.product_variants where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and sku = 'EAU-001'),
        'location_id', (select id from public.stock_locations where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and code = 'PRINCIPAL'),
        'quantity_delta', -2
      ),
      jsonb_build_object(
        'variant_id', (select id from public.product_variants where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and sku = 'EAU-001'),
        'location_id', (select id from public.stock_locations where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and code = 'RESERVE'),
        'quantity_delta', 1
      )
    ),
    null
  )$$,
  '22023',
  'Transfer must balance each variant across locations',
  'unbalanced transfer is rejected before any stock change'
);
select lives_ok(
  $$select public.post_stock_operation(
    '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01',
    'transfer',
    'transfer-key-0001',
    'Réapprovisionnement de la réserve',
    'TRANSFER-TEST-001',
    jsonb_build_array(
      jsonb_build_object(
        'variant_id', (select id from public.product_variants where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and sku = 'EAU-001'),
        'location_id', (select id from public.stock_locations where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and code = 'PRINCIPAL'),
        'quantity_delta', -2
      ),
      jsonb_build_object(
        'variant_id', (select id from public.product_variants where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and sku = 'EAU-001'),
        'location_id', (select id from public.stock_locations where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and code = 'RESERVE'),
        'quantity_delta', 2
      )
    ),
    null
  )$$,
  'balanced transfer is accepted'
);
select results_eq(
  $$select on_hand::integer from public.stock_balances
    where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01'
      and variant_id = (select id from public.product_variants where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and sku = 'EAU-001')
      and location_id = (select id from public.stock_locations where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and code = 'PRINCIPAL')$$,
  $$values (4)$$,
  'transfer decrements the source location'
);
select results_eq(
  $$select on_hand::integer from public.stock_balances
    where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01'
      and variant_id = (select id from public.product_variants where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and sku = 'EAU-001')
      and location_id = (select id from public.stock_locations where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and code = 'RESERVE')$$,
  $$values (2)$$,
  'transfer increments the destination location'
);
select results_eq(
  $$select sum(on_hand)::integer from public.stock_balances
    where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01'
      and variant_id = (select id from public.product_variants where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and sku = 'EAU-001')$$,
  $$values (6)$$,
  'transfer conserves total tenant stock'
);
select lives_ok(
  $$select public.post_stock_operation(
    '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01',
    'reversal',
    'reversal-key-0001',
    'Annulation du transfert de test',
    null,
    '[]'::jsonb,
    (select id from public.stock_operations where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and reference = 'TRANSFER-TEST-001')
  )$$,
  'a transfer can be reversed with a new immutable operation'
);
select results_eq(
  $$select on_hand::integer from public.stock_balances
    where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01'
      and variant_id = (select id from public.product_variants where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and sku = 'EAU-001')
      and location_id = (select id from public.stock_locations where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and code = 'PRINCIPAL')$$,
  $$values (6)$$,
  'reversal restores the source stock without deleting history'
);
select results_eq(
  $$select on_hand::integer from public.stock_balances
    where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01'
      and variant_id = (select id from public.product_variants where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and sku = 'EAU-001')
      and location_id = (select id from public.stock_locations where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and code = 'RESERVE')$$,
  $$values (0)$$,
  'reversal removes the destination stock without deleting history'
);
select results_eq(
  $$select status from public.stock_operations
    where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and reference = 'TRANSFER-TEST-001'$$,
  $$values ('reversed')$$,
  'reversed operation is marked without changing its movements'
);
select lives_ok(
  $$select public.post_stock_operation(
    '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01',
    'reversal',
    'reversal-key-0001',
    'Annulation du transfert de test',
    null,
    '[]'::jsonb,
    (select id from public.stock_operations where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and reference = 'TRANSFER-TEST-001')
  )$$,
  'an identical reversal retry is accepted'
);
select results_eq(
  $$select count(*)::integer from public.stock_operations
    where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and idempotency_key = 'reversal-key-0001'$$,
  $$values (1)$$,
  'reversal retry remains idempotent'
);
select throws_ok(
  $$update public.stock_balances set on_hand = 999$$,
  '42501',
  null,
  'authenticated user cannot update stock balances directly'
);
select throws_ok(
  $$delete from public.stock_movements$$,
  '42501',
  null,
  'authenticated user cannot delete stock history'
);
select results_eq(
  $$select count(*)::integer from public.stock_movement_history
    where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01'$$,
  $$values (6)$$,
  'all six opening, adjustment, transfer and reversal movements remain traceable'
);
select results_eq(
  $$select sum(available)::integer from public.stock_overview
    where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01'$$,
  $$values (6)$$,
  'available stock is derived from physical minus reserved stock'
);
select throws_ok(
  $$select public.post_stock_operation(
    '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01',
    'opening',
    'opening-key-0001',
    'Charge différente',
    'INIT-001',
    jsonb_build_array(jsonb_build_object(
      'variant_id', (select id from public.product_variants where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and sku = 'EAU-001'),
      'location_id', (select id from public.stock_locations where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and code = 'PRINCIPAL'),
      'quantity_delta', 11
    )),
    null
  )$$,
  '22023',
  'Idempotency key payload mismatch',
  'an idempotency key cannot be reused for a different payload'
);
select throws_ok(
  $$insert into public.products(tenant_id, name, sale_price, cost_price)
    values ('4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', 'Écriture directe', 1, 1)$$,
  '42501',
  null,
  'authenticated user cannot bypass the product RPC with a direct insert'
);

-- SKU automatique et stock de départ (migration 202611030001) -------------
select public.upsert_product(
  '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', null, null, null,
  'Savon parfumé', null, 250, 0, null, null, '{}'::jsonb, true, null, 4, null
);
select matches(
  (select sku from public.product_variants
    where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01'
      and product_id = (select id from public.products
                        where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and name = 'Savon parfumé')),
  '^SAVONP-[0-9]{3}$',
  'a product saved without SKU receives a generated SKU'
);
select results_eq(
  $$select on_hand::integer from public.stock_balances
    where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01'
      and variant_id = (select id from public.product_variants
                        where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and sku like 'SAVONP-%')$$,
  $$values (4)$$,
  'the initial quantity is posted as opening stock'
);
select public.upsert_product(
  '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', null, null, null,
  'Savon doux', null, 250, 0, null, null, '{}'::jsonb, true, null, null, null
);
select results_eq(
  $$select count(distinct sku)::integer from public.product_variants
    where tenant_id = '4f5c6bd8-9b79-4b69-9b76-4b4b47b91a01' and sku like 'SAVONP-%'$$,
  $$values (2)$$,
  'two products with the same name receive two different generated SKUs'
);
select has_function(
  'public', 'generate_product_sku', array['uuid', 'text'],
  'the SKU generator is exposed to the application'
);

select * from finish();
rollback;


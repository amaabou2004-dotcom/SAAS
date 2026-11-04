begin;

select plan(8);

-- Test fixtures only. The password column is deliberately empty: these users
-- cannot sign in and all changes are rolled back at the end of this file.
insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '0f5c6bd8-9b79-4b69-9b76-4b4b47b91a01',
    'authenticated',
    'authenticated',
    'owner-one@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '0f5c6bd8-9b79-4b69-9b76-4b4b47b91a02',
    'authenticated',
    'authenticated',
    'owner-two@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.tenants(id, name, slug) values
  ('1f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', 'Entreprise Un', 'tenant-one'),
  ('1f5c6bd8-9b79-4b69-9b76-4b4b47b91a02', 'Entreprise Deux', 'tenant-two');

insert into public.roles(id, tenant_id, name, is_system) values
  ('2f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', '1f5c6bd8-9b79-4b69-9b76-4b4b47b91a01', 'Propriétaire', true),
  ('2f5c6bd8-9b79-4b69-9b76-4b4b47b91a02', '1f5c6bd8-9b79-4b69-9b76-4b4b47b91a02', 'Propriétaire', true);

insert into public.memberships(tenant_id, user_id, role_id) values
  (
    '1f5c6bd8-9b79-4b69-9b76-4b4b47b91a01',
    '0f5c6bd8-9b79-4b69-9b76-4b4b47b91a01',
    '2f5c6bd8-9b79-4b69-9b76-4b4b47b91a01'
  ),
  (
    '1f5c6bd8-9b79-4b69-9b76-4b4b47b91a02',
    '0f5c6bd8-9b79-4b69-9b76-4b4b47b91a02',
    '2f5c6bd8-9b79-4b69-9b76-4b4b47b91a02'
  );

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"0f5c6bd8-9b79-4b69-9b76-4b4b47b91a01","role":"authenticated"}';

select results_eq(
  $$select slug from public.tenants order by slug$$,
  $$values ('tenant-one')$$,
  'first user sees only the first tenant'
);

select is_empty(
  $$select * from public.tenants where slug = 'tenant-two'$$,
  'first user cannot read the second tenant by filtering on its slug'
);

select lives_ok(
  $$select public.create_tenant(
    'Entreprise Créée',
    'created-by-owner',
    'XOF',
    'Africa/Niamey'
  )$$,
  'confirmed user can create a tenant through the controlled RPC'
);

select results_eq(
  $$select count(*)::integer from public.memberships where tenant_id = (
    select id from public.tenants where slug = 'created-by-owner'
  )$$,
  $$values (1)$$,
  'tenant RPC creates exactly one owner membership'
);

select results_eq(
  $$select count(*)::integer from public.role_permissions where tenant_id = (
    select id from public.tenants where slug = 'created-by-owner'
  )$$,
  $$values (15)$$,
  'tenant RPC grants every initial permission to the owner role'
);

select throws_ok(
  $$insert into public.tenants(name, slug) values ('Écriture directe', 'direct-write')$$,
  '42501',
  null,
  'authenticated user cannot bypass the controlled tenant creation RPC'
);

set local "request.jwt.claims" = '{"sub":"0f5c6bd8-9b79-4b69-9b76-4b4b47b91a02","role":"authenticated"}';

select results_eq(
  $$select slug from public.tenants order by slug$$,
  $$values ('tenant-two')$$,
  'second user sees neither the first tenant nor its newly created tenant'
);

reset role;
set local role anon;
set local "request.jwt.claims" = '{}';

select throws_ok(
  $$select * from public.tenants$$,
  '42501',
  null,
  'anonymous database role has no tenant select privilege'
);

select * from finish();
rollback;

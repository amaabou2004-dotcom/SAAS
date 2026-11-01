begin;

select plan(18);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'tenants', 'tenants table exists');
select has_table('public', 'memberships', 'memberships table exists');
select has_table('public', 'roles', 'roles table exists');
select has_table('public', 'permissions', 'permissions table exists');
select has_table('public', 'role_permissions', 'role_permissions table exists');

select has_function(
  'public',
  'create_tenant',
  array['text', 'text', 'text', 'text'],
  'transactional tenant creation function exists'
);
select has_function(
  'public',
  'is_tenant_member',
  array['uuid'],
  'membership helper exists'
);
select has_function(
  'public',
  'has_tenant_permission',
  array['uuid', 'text'],
  'permission helper exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS is enabled on profiles'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.tenants'::regclass),
  'RLS is enabled on tenants'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.memberships'::regclass),
  'RLS is enabled on memberships'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.roles'::regclass),
  'RLS is enabled on roles'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.role_permissions'::regclass),
  'RLS is enabled on role_permissions'
);

select throws_ok(
  $$insert into public.tenants(name, slug, currency_code, timezone)
    values ('Invalid', 'Slug Invalide', 'XOF', 'Africa/Niamey')$$,
  '23514',
  null,
  'tenant slug constraint rejects unsafe public identifiers'
);
select throws_ok(
  $$insert into public.tenants(name, slug, currency_code, timezone)
    values ('Invalid', 'valid-slug', 'xof', 'Africa/Niamey')$$,
  '23514',
  null,
  'currency constraint requires an uppercase ISO-style code'
);
select results_eq(
  $$select count(*)::integer from public.permissions$$,
  $$values (15)$$,
  'all initial permissions are seeded'
);
select is(
  (select count(*)::integer from information_schema.table_privileges
   where table_schema = 'public'
     and table_name = 'tenants'
     and grantee = 'anon'),
  0,
  'anonymous role has no direct tenant privileges'
);

select * from finish();
rollback;

begin;

select plan(4);

-- 1. L'adresse de l'éditeur devient administratrice à l'inscription.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('0f5c6bd8-9b79-4b69-9b76-4b4b47b91a0b', 'authenticated', 'authenticated', 'amaabou2004@gmail.com', '', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('0f5c6bd8-9b79-4b69-9b76-4b4b47b91a0c', 'authenticated', 'authenticated', 'visiteur@example.test', '', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

select is(
  (select count(*)::integer
   from public.platform_admins
   where user_id = '0f5c6bd8-9b79-4b69-9b76-4b4b47b91a0b'),
  1,
  'l’adresse de l’éditeur est nommée administratrice automatiquement'
);

select is(
  (select count(*)::integer
   from public.platform_admins
   where user_id = '0f5c6bd8-9b79-4b69-9b76-4b4b47b91a0c'),
  0,
  'un autre compte n’est pas administrateur'
);

-- 2. L'administrateur obtient la vue d'ensemble.
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"0f5c6bd8-9b79-4b69-9b76-4b4b47b91a0b","role":"authenticated"}';

select ok(
  public.platform_overview() ? 'totals',
  'un administrateur obtient la vue d’ensemble de la plateforme'
);

-- 3. Un compte ordinaire ne voit rien.
set local "request.jwt.claims" = '{"sub":"0f5c6bd8-9b79-4b69-9b76-4b4b47b91a0c","role":"authenticated"}';

select throws_ok(
  $$select public.platform_overview()$$,
  '42501',
  null,
  'un compte ordinaire ne peut pas lire la vue d’ensemble'
);

reset role;

select * from finish();
rollback;

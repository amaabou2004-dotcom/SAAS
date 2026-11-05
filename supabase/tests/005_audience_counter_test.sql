begin;

select plan(6);

-- 1. Un utilisateur connecté ordinaire n'est pas administrateur de la plateforme.
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"0f5c6bd8-9b79-4b69-9b76-4b4b47b91a0a","role":"authenticated"}';

select is(
  public.is_platform_admin(),
  false,
  'un utilisateur ordinaire n’est pas administrateur de la plateforme'
);

-- 2. Un visiteur non connecté peut enregistrer une vue (et seulement une).
reset role;
set local role anon;
set local "request.headers" = '{"x-forwarded-for":"41.203.70.12","user-agent":"Test/T1"}';

select lives_ok(
  $$select public.track_page_view('/', 'whatsapp.com')$$,
  'un visiteur anonyme peut enregistrer une vue'
);

select lives_ok(
  $$select public.track_page_view('/', 'whatsapp.com')$$,
  'renvoyer la même vue ne provoque pas d’erreur'
);

reset role;

select is(
  (select count(*)::integer from public.page_views),
  1,
  'la deuxième vue identique n’est pas comptée deux fois'
);

-- 3. Les tables restent fermées : aucune lecture directe possible.
set local role anon;

select throws_ok(
  $$select * from public.page_views$$,
  '42501',
  null,
  'un visiteur ne peut pas lire le journal des visites'
);

select throws_ok(
  $$select public.audience_summary(7)$$,
  '42501',
  null,
  'un visiteur ne peut pas lire les chiffres d’audience'
);

reset role;

select * from finish();
rollback;

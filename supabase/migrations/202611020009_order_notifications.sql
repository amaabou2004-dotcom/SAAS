-- 202611020009_order_notifications.sql
-- ---------------------------------------------------------------------------
-- Prévenir le commerçant par e-mail à chaque commande reçue sur sa boutique.
--
-- Gratuit de bout en bout :
--   * aucune société tierce payante n'est nécessaire : Brevo propose 300 e-mails
--     par jour en plan gratuit (une simple adresse expéditrice vérifiée suffit,
--     pas besoin d'un nom de domaine) ;
--   * la clé d'envoi reste dans **Vault** (secrets du projet Supabase), jamais
--     dans le navigateur ni dans le dépôt ;
--   * l'envoi est fait par la base elle-même (`pg_net` + `pg_cron`), donc cela
--     fonctionne même en mode « direct », sans serveur Node déployé.
--
-- Fonctionnement :
--   1. `notification_settings` : l'adresse e-mail du commerçant (une par
--      entreprise) et l'interrupteur « prévenir à chaque commande ».
--   2. Une commande insérée dans `storefront_orders` crée une ligne dans
--      `notification_outbox` (une seule par commande, même en cas de rejeu).
--   3. `dispatch_notifications()` envoie les messages en attente (appelée
--      chaque minute par `pg_cron`), `sync_notification_status()` lit la
--      réponse du fournisseur et marque « envoyé » ou réessaie.
--   4. Si la clé n'est pas encore installée, les messages restent « en attente »
--      (rien n'est perdu) et l'interface l'explique.
-- ---------------------------------------------------------------------------
begin;

-- 1. Les réglages du commerçant.
create table if not exists public.notification_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  recipient_email text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_settings_email_valid check (
    recipient_email = lower(btrim(recipient_email))
    and recipient_email ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
    and char_length(recipient_email) <= 160
  )
);

-- 2. La file d'attente des messages.
create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid,
  kind text not null default 'storefront_order',
  recipient_email text not null,
  subject text not null,
  body_text text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  provider_request_id bigint,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint notification_outbox_kind_valid check (kind in ('storefront_order'))
);

create index if not exists notification_outbox_pending_idx
  on public.notification_outbox (created_at)
  where status = 'pending';

-- Une seule notification par commande : le rejeu d'une commande ne renvoie pas
-- deux e-mails.
create unique index if not exists notification_outbox_order_unique
  on public.notification_outbox (order_id, kind)
  where order_id is not null;

alter table public.notification_settings enable row level security;
alter table public.notification_outbox enable row level security;

-- Aucun accès direct : tout passe par les fonctions ci-dessous.
revoke all on table public.notification_settings from anon, authenticated;
revoke all on table public.notification_outbox from anon, authenticated;

-- 3. Mise en file automatique à chaque commande.
create or replace function public.queue_storefront_order_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.notification_settings;
  v_tenant public.tenants;
  v_number text := 'CMD-' || lpad(new.seq::text, 6, '0');
  v_lines text := '';
  v_item record;
  v_when text;
begin
  select * into v_settings from public.notification_settings where tenant_id = new.tenant_id;
  if not found or not v_settings.enabled then
    return new;
  end if;

  select * into v_tenant from public.tenants where id = new.tenant_id;
  if not found then
    return new;
  end if;

  for v_item in
    select product_name, sku, quantity, line_total
    from public.storefront_order_items
    where order_id = new.id
    order by product_name
  loop
    v_lines := v_lines || '- ' || v_item.quantity::text || ' × ' || v_item.product_name
      || ' (' || v_item.sku || ') : ' || round(v_item.line_total, 2)::text
      || ' ' || v_tenant.currency_code || E'\n';
  end loop;

  v_when := to_char(new.created_at at time zone coalesce(v_tenant.timezone, 'Africa/Niamey'), 'DD/MM/YYYY HH24:MI');

  insert into public.notification_outbox (tenant_id, order_id, kind, recipient_email, subject, body_text)
  values (
    new.tenant_id,
    new.id,
    'storefront_order',
    v_settings.recipient_email,
    'Nouvelle commande ' || v_number || ' — ' || coalesce(v_tenant.name, 'votre boutique'),
    'Bonjour,' || E'\n\n'
      || 'Une nouvelle commande vient d''arriver sur votre boutique.' || E'\n\n'
      || 'Commande : ' || v_number || E'\n'
      || 'Client : ' || new.customer_name || ' (' || new.customer_phone || ')' || E'\n'
      || 'Reçue le : ' || v_when || E'\n\n'
      || 'Articles :' || E'\n' || v_lines || E'\n'
      || 'Total : ' || round(new.total, 2)::text || ' ' || v_tenant.currency_code || E'\n'
      || coalesce('Précision du client : ' || new.note || E'\n', '')
      || E'\n' || 'Pour la confirmer, ouvrez Stokari → onglet Boutique → « À confirmer ».'
      || E'\n\n' || 'Message automatique envoyé depuis Stokari.'
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists storefront_orders_notify on public.storefront_orders;
create trigger storefront_orders_notify
  after insert on public.storefront_orders
  for each row execute function public.queue_storefront_order_notification();

-- 4. Le texte du message, construit au moment de l'envoi (les lignes de la
--    commande sont insérées après son en-tête, elles n'existent pas encore
--    au moment de la mise en file).
create or replace function public.order_notification_body(p_order_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.storefront_orders;
  v_tenant public.tenants;
  v_lines text := '';
  v_item record;
  v_when text;
  v_number text;
begin
  select * into v_order from public.storefront_orders where id = p_order_id;
  if not found then
    return '';
  end if;

  select * into v_tenant from public.tenants where id = v_order.tenant_id;
  if not found then
    return '';
  end if;

  v_number := 'CMD-' || lpad(v_order.seq::text, 6, '0');

  for v_item in
    select product_name, sku, quantity, line_total
    from public.storefront_order_items
    where order_id = v_order.id
    order by product_name
  loop
    v_lines := v_lines || '- ' || trim_scale(v_item.quantity)::text || ' × ' || v_item.product_name
      || ' (' || v_item.sku || ') : ' || trim_scale(round(v_item.line_total, 2))::text
      || ' ' || v_tenant.currency_code || E'\n';
  end loop;

  v_when := to_char(v_order.created_at at time zone coalesce(v_tenant.timezone, 'Africa/Niamey'), 'DD/MM/YYYY HH24:MI');

  return 'Bonjour,' || E'\n\n'
    || 'Une nouvelle commande vient d''arriver sur votre boutique.' || E'\n\n'
    || 'Commande : ' || v_number || E'\n'
    || 'Client : ' || v_order.customer_name || ' (' || v_order.customer_phone || ')' || E'\n'
    || 'Reçue le : ' || v_when || E'\n\n'
    || 'Articles :' || E'\n' || v_lines || E'\n'
    || 'Total : ' || trim_scale(round(v_order.total, 2))::text || ' ' || v_tenant.currency_code || E'\n'
    || coalesce('Précision du client : ' || v_order.note || E'\n', '')
    || E'\n' || 'Pour la confirmer, ouvrez Stokari → onglet Boutique → « À confirmer ».'
    || E'\n\n' || 'Message automatique envoyé depuis Stokari.';
end;
$$;

revoke all on function public.order_notification_body(uuid) from public;

-- 5. L'envoi (pg_net) et le suivi de la réponse.
create extension if not exists pg_net;

create or replace function public.dispatch_notifications(p_limit integer default 20)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_from text;
  v_request bigint;
  v_body text;
  v_row record;
  v_count integer := 0;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'brevo_api_key';
  select decrypted_secret into v_from from vault.decrypted_secrets where name = 'mail_from';

  -- Pas encore de clé : les messages restent en attente, rien n'est perdu.
  if v_key is null or v_from is null then
    return 0;
  end if;

  for v_row in
    select * from public.notification_outbox
    where status = 'pending' and attempts < 5
    order by created_at
    limit coalesce(p_limit, 20)
  loop
    -- Corps reconstruit à l'envoi : il contient alors toutes les lignes.
    v_body := case
      when v_row.order_id is not null
        then coalesce(nullif(public.order_notification_body(v_row.order_id), ''), v_row.body_text)
      else v_row.body_text
    end;

    select net.http_post(
      url := 'https://api.brevo.com/v3/smtp/email',
      headers := jsonb_build_object(
        'accept', 'application/json',
        'content-type', 'application/json',
        'api-key', v_key
      ),
      body := jsonb_build_object(
        'sender', jsonb_build_object('name', 'Stokari', 'email', v_from),
        'to', jsonb_build_array(jsonb_build_object('email', v_row.recipient_email)),
        'subject', v_row.subject,
        'textContent', v_body
      ),
      timeout_milliseconds := 10000
    ) into v_request;

    update public.notification_outbox
    set status = 'sending',
        attempts = attempts + 1,
        provider_request_id = v_request,
        last_error = null,
        body_text = v_body
    where id = v_row.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.sync_notification_status(p_limit integer default 50)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_code integer;
  v_found boolean;
  v_message text;
  v_total integer := 0;
begin
  for v_row in
    select * from public.notification_outbox
    where status = 'sending' and provider_request_id is not null
    order by created_at
    limit coalesce(p_limit, 50)
  loop
    v_code := null;
    v_found := false;

    select response.status_code, coalesce(response.error_msg, left(coalesce(response.content, ''), 300))
      into v_code, v_message
    from net._http_response as response
    where response.id = v_row.provider_request_id
      and (response.status_code is not null or response.error_msg is not null);

    v_found := found;

    -- Réponse pas encore arrivée : on repassera à la minute suivante.
    if not v_found then
      continue;
    end if;

    if v_code is not null and v_code between 200 and 299 then
      update public.notification_outbox
      set status = 'sent', sent_at = now(), last_error = null
      where id = v_row.id;
    elsif v_row.attempts >= 5 then
      update public.notification_outbox
      set status = 'failed', last_error = left(coalesce(v_message, 'Échec de l’envoi'), 400)
      where id = v_row.id;
    else
      -- Nouvel essai à la minute suivante (clé erronée, réseau coupé…).
      update public.notification_outbox
      set status = 'pending', last_error = left(coalesce(v_message, 'Échec de l’envoi'), 400)
      where id = v_row.id;
    end if;

    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

-- Toutes les minutes : envoyer ce qui attend, puis relever les réponses.
do $$
begin
  begin
    execute 'create extension if not exists pg_cron';
  exception when others then
    null;
  end;

  begin
    perform cron.unschedule('stokari_notifications_dispatch');
  exception when others then
    null;
  end;

  begin
    perform cron.unschedule('stokari_notifications_sync');
  exception when others then
    null;
  end;

  begin
    perform cron.schedule('stokari_notifications_dispatch', '* * * * *', 'select public.dispatch_notifications(20)');
  exception when others then
    null;
  end;

  begin
    perform cron.schedule('stokari_notifications_sync', '* * * * *', 'select public.sync_notification_status(50)');
  exception when others then
    null;
  end;
end $$;

-- 6. Les fonctions appelées par l'application.
create or replace function public.notification_settings_get(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.notification_settings;
  v_ready boolean;
begin
  if not public.has_tenant_permission(p_tenant_id, 'stores.manage') then
    raise exception 'Boutique : droit « gérer la boutique » requis' using errcode = '42501';
  end if;

  select exists (
    select 1 from vault.decrypted_secrets
    where name in ('brevo_api_key', 'mail_from')
    having count(*) = 2
  ) into v_ready;

  select * into v_settings from public.notification_settings where tenant_id = p_tenant_id;
  if not found then
    return jsonb_build_object(
      'recipient_email', null,
      'enabled', false,
      'provider_ready', v_ready
    );
  end if;

  return jsonb_build_object(
    'recipient_email', v_settings.recipient_email,
    'enabled', v_settings.enabled,
    'provider_ready', v_ready
  );
end;
$$;

create or replace function public.notification_settings_save(
  p_tenant_id uuid,
  p_recipient_email text,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_recipient_email, '')));
begin
  if not public.has_tenant_permission(p_tenant_id, 'stores.manage') then
    raise exception 'Boutique : droit « gérer la boutique » requis' using errcode = '42501';
  end if;

  if v_email = '' then
    -- Plus d'adresse : on désactive les alertes et on efface le réglage.
    delete from public.notification_settings where tenant_id = p_tenant_id;
    return jsonb_build_object('recipient_email', null, 'enabled', false, 'provider_ready', false);
  end if;

  if v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' or char_length(v_email) > 160 then
    raise exception 'Adresse e-mail invalide' using errcode = '22023';
  end if;

  insert into public.notification_settings (tenant_id, recipient_email, enabled, updated_at)
  values (p_tenant_id, v_email, coalesce(p_enabled, true), now())
  on conflict (tenant_id) do update
    set recipient_email = excluded.recipient_email,
        enabled = excluded.enabled,
        updated_at = now();

  return public.notification_settings_get(p_tenant_id);
end;
$$;

create or replace function public.notifications_list(p_tenant_id uuid, p_limit integer default 10)
returns table (
  id uuid,
  order_id uuid,
  recipient_email text,
  subject text,
  status text,
  attempts integer,
  last_error text,
  created_at timestamptz,
  sent_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_tenant_permission(p_tenant_id, 'stores.manage') then
    raise exception 'Boutique : droit « gérer la boutique » requis' using errcode = '42501';
  end if;

  return query
    select outbox.id,
           outbox.order_id,
           outbox.recipient_email,
           outbox.subject,
           outbox.status,
           outbox.attempts,
           outbox.last_error,
           outbox.created_at,
           outbox.sent_at
    from public.notification_outbox as outbox
    where outbox.tenant_id = p_tenant_id
    order by outbox.created_at desc
    limit greatest(coalesce(p_limit, 10), 1);
end;
$$;

revoke all on function public.notification_settings_get(uuid) from public;
revoke all on function public.notification_settings_save(uuid, text, boolean) from public;
revoke all on function public.notifications_list(uuid, integer) from public;
revoke all on function public.dispatch_notifications(integer) from public;
revoke all on function public.sync_notification_status(integer) from public;

grant execute on function public.notification_settings_get(uuid) to authenticated;
grant execute on function public.notification_settings_save(uuid, text, boolean) to authenticated;
grant execute on function public.notifications_list(uuid, integer) to authenticated;

commit;

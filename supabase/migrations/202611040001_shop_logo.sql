-- 202611040001_shop_logo.sql
-- ---------------------------------------------------------------------------
-- Logo de la boutique en ligne.
--
--   1. `storefront_settings.logo_url` : l'adresse publique du logo (Supabase
--      Storage). Vide = la boutique garde l'icône par défaut.
--   2. Un bucket public `shop-logos` (2 Mo max, JPEG/PNG/WebP) : lecture libre
--      puisque la vitrine est publique, écriture réservée aux membres qui
--      gèrent la boutique (`stores.manage`). Le chemin est `{tenant_id}/...` :
--      la politique lit l'entreprise dans le chemin, donc aucune entreprise ne
--      peut écrire dans le dossier d'une autre.
--   3. `storefront_settings_get` / `storefront_settings_save` transportent le
--      logo (l'enregistrer, le remplacer ou l'effacer en envoyant `null`).
--   4. `storefront_info` renvoie `logo_url` : la page publique l'affiche en
--      haut, à la place de l'icône générique.
-- ---------------------------------------------------------------------------
begin;

-- 1. La colonne logo.
alter table public.storefront_settings add column if not exists logo_url text;

alter table public.storefront_settings drop constraint if exists storefront_settings_logo_valid;
alter table public.storefront_settings
  add constraint storefront_settings_logo_valid
  check (logo_url is null or (logo_url ~ '^https?://' and char_length(logo_url) <= 800));

-- 2. Le bucket et ses règles d'accès.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-logos',
  'shop-logos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists shop_logos_read on storage.objects;
create policy shop_logos_read on storage.objects
  for select
  using (bucket_id = 'shop-logos');

drop policy if exists shop_logos_insert on storage.objects;
create policy shop_logos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'shop-logos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.has_tenant_permission(((storage.foldername(name))[1])::uuid, 'stores.manage')
  );

drop policy if exists shop_logos_update on storage.objects;
create policy shop_logos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'shop-logos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.has_tenant_permission(((storage.foldername(name))[1])::uuid, 'stores.manage')
  )
  with check (
    bucket_id = 'shop-logos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.has_tenant_permission(((storage.foldername(name))[1])::uuid, 'stores.manage')
  );

drop policy if exists shop_logos_delete on storage.objects;
create policy shop_logos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'shop-logos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.has_tenant_permission(((storage.foldername(name))[1])::uuid, 'stores.manage')
  );

-- 3. Les réglages côté commerçant transportent le logo.
create or replace function public.storefront_settings_get(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.storefront_settings;
  v_tenant public.tenants;
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'Vous n’avez pas accès à cette entreprise.' using errcode = '42501';
  end if;

  select * into v_tenant from public.tenants where id = p_tenant_id;
  select * into v_settings from public.storefront_settings where tenant_id = p_tenant_id;

  if not found then
    return jsonb_build_object(
      'tenant_id', p_tenant_id,
      'slug', '',
      'display_name', v_tenant.name,
      'whatsapp', null,
      'published', false,
      'default_location_id', null,
      'public_path', null,
      'logo_url', null,
      'currency_code', v_tenant.currency_code
    );
  end if;

  return jsonb_build_object(
    'tenant_id', p_tenant_id,
    'slug', v_settings.slug,
    'display_name', coalesce(v_settings.display_name, v_tenant.name),
    'whatsapp', v_settings.whatsapp,
    'published', v_settings.published,
    'default_location_id', v_settings.default_location_id,
    'public_path', case when v_settings.published then '/b/' || v_settings.slug else null end,
    'logo_url', v_settings.logo_url,
    'currency_code', v_tenant.currency_code
  );
end;
$$;

-- La signature change (un argument de plus) : on retire l'ancienne version.
drop function if exists public.storefront_settings_save(uuid, text, text, text, boolean, uuid);

create or replace function public.storefront_settings_save(
  p_tenant_id uuid,
  p_slug text,
  p_display_name text,
  p_whatsapp text,
  p_published boolean,
  p_default_location_id uuid,
  p_logo_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_name text := nullif(btrim(coalesce(p_display_name, '')), '');
  v_whatsapp text := nullif(btrim(coalesce(p_whatsapp, '')), '');
  v_logo text := nullif(btrim(coalesce(p_logo_url, '')), '');
begin
  if not public.has_tenant_permission(p_tenant_id, 'stores.manage') then
    raise exception 'Seul un administrateur peut modifier la boutique.' using errcode = '42501';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' then
    raise exception 'Adresse de boutique invalide : 3 à 40 caractères, lettres minuscules, chiffres et tirets.' using errcode = '22023';
  end if;
  if v_name is not null and char_length(v_name) > 80 then
    raise exception 'Nom affiché trop long (80 caractères maximum).' using errcode = '22023';
  end if;
  if v_whatsapp is not null and (char_length(v_whatsapp) > 32 or v_whatsapp !~ '^[0-9+() .-]+$') then
    raise exception 'Numéro WhatsApp invalide.' using errcode = '22023';
  end if;
  if v_logo is not null and (char_length(v_logo) > 800 or v_logo !~ '^https?://') then
    raise exception 'Adresse du logo invalide.' using errcode = '22023';
  end if;
  if p_default_location_id is not null and not exists (
    select 1 from public.stock_locations
    where id = p_default_location_id and tenant_id = p_tenant_id and active
  ) then
    raise exception 'Emplacement inconnu pour cette entreprise.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.storefront_settings
    where slug = v_slug and tenant_id <> p_tenant_id
  ) then
    raise exception 'Cette adresse de boutique est déjà prise.' using errcode = '23505';
  end if;

  insert into public.storefront_settings (
    tenant_id, slug, display_name, whatsapp, published, default_location_id, logo_url
  ) values (
    p_tenant_id, v_slug, v_name, v_whatsapp, coalesce(p_published, false), p_default_location_id, v_logo
  )
  on conflict (tenant_id) do update
    set slug = excluded.slug,
        display_name = excluded.display_name,
        whatsapp = excluded.whatsapp,
        published = excluded.published,
        default_location_id = excluded.default_location_id,
        logo_url = excluded.logo_url,
        updated_at = now();

  return public.storefront_settings_get(p_tenant_id);
end;
$$;

revoke all on function public.storefront_settings_get(uuid) from public, anon;
revoke all on function public.storefront_settings_save(uuid, text, text, text, boolean, uuid, text) from public, anon;
grant execute on function public.storefront_settings_get(uuid) to authenticated;
grant execute on function public.storefront_settings_save(uuid, text, text, text, boolean, uuid, text) to authenticated;

-- 4. La vitrine publique affiche le logo.
create or replace function public.storefront_info(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.storefront_settings;
  v_tenant public.tenants;
begin
  select * into v_settings from public.storefront_settings where slug = lower(btrim(coalesce(p_slug, '')));
  if not found or not v_settings.published then
    return null;
  end if;

  select * into v_tenant from public.tenants where id = v_settings.tenant_id;
  if not found or v_tenant.status <> 'active' then
    return null;
  end if;

  return jsonb_build_object(
    'slug', v_settings.slug,
    'display_name', coalesce(nullif(btrim(coalesce(v_settings.display_name, '')), ''), v_tenant.name),
    'whatsapp', nullif(btrim(coalesce(v_settings.whatsapp, '')), ''),
    'logo_url', v_settings.logo_url,
    'currency_code', v_tenant.currency_code,
    'timezone', v_tenant.timezone,
    'tenant_name', v_tenant.name
  );
end;
$$;

revoke all on function public.storefront_info(text) from public;
grant execute on function public.storefront_info(text) to anon, authenticated;

commit;

-- 202611020008_product_images.sql
-- ---------------------------------------------------------------------------
-- Photos des produits, prises ou choisies depuis la galerie du téléphone.
--
--   1. `products.image_url` : l'adresse publique de la photo (Supabase
--      Storage). Vide = pas de photo.
--   2. Un bucket public `product-images` : lecture libre (la vitrine est
--      publique), écriture réservée aux membres qui gèrent le catalogue.
--      Le chemin est `{tenant_id}/{fichier}` : la politique de sécurité lit
--      l'entreprise dans le chemin et vérifie `catalog.manage`, donc une
--      entreprise ne peut jamais écrire dans le dossier d'une autre.
--   3. `upsert_product(..., p_image_url)` : la photo s'enregistre avec le
--      reste de la fiche produit (et s'efface en envoyant `null`).
--   4. `storefront_catalog` renvoie `image_url` : le catalogue partagé sur
--      WhatsApp devient illustré.
--
-- Limites : 8 Mo par image, formats JPEG/PNG/WebP. Le navigateur réduit la
-- photo avant l'envoi (voir `apps/web/src/features/workspace/product-image.ts`)
-- pour économiser la connexion mobile.
-- ---------------------------------------------------------------------------
begin;

-- 1. La colonne photo.
alter table public.products add column if not exists image_url text;

alter table public.products drop constraint if exists products_image_url_valid;
alter table public.products
  add constraint products_image_url_valid
  check (image_url is null or (image_url ~ '^https?://' and char_length(image_url) <= 800));

-- 2. Le bucket et ses règles d'accès.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Lecture publique : une photo de produit n'est pas une donnée sensible et la
-- vitrine doit s'afficher sans compte.
drop policy if exists product_images_read on storage.objects;
create policy product_images_read on storage.objects
  for select
  using (bucket_id = 'product-images');

-- Écriture : seulement dans le dossier de son entreprise, avec `catalog.manage`.
drop policy if exists product_images_insert on storage.objects;
create policy product_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.has_tenant_permission(((storage.foldername(name))[1])::uuid, 'catalog.manage')
  );

drop policy if exists product_images_delete on storage.objects;
create policy product_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.has_tenant_permission(((storage.foldername(name))[1])::uuid, 'catalog.manage')
  );

-- 3. La fiche produit enregistre sa photo.
--    La signature change : on remplace l'ancienne version avant de recréer.
drop function if exists public.upsert_product(
  uuid, uuid, uuid, uuid, text, text, numeric, numeric, text, text, jsonb, boolean
);

create or replace function public.upsert_product(
  p_tenant_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_category_id uuid,
  p_name text,
  p_description text,
  p_sale_price numeric,
  p_cost_price numeric,
  p_sku text,
  p_barcode text,
  p_attributes jsonb,
  p_active boolean,
  p_image_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_product public.products%rowtype;
  saved_variant public.product_variants%rowtype;
  v_image text := nullif(btrim(coalesce(p_image_url, '')), '');
begin
  if (select auth.uid()) is null
    or not public.has_tenant_permission(p_tenant_id, 'catalog.manage') then
    raise exception 'Catalog management permission required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id and status = 'active') then
    raise exception 'Active tenant required' using errcode = '42501';
  end if;
  if p_name is null or p_name <> btrim(p_name) or char_length(p_name) not between 2 and 160 then
    raise exception 'Invalid product name' using errcode = '22023';
  end if;
  if p_description is not null and char_length(p_description) > 5000 then
    raise exception 'Invalid product description' using errcode = '22023';
  end if;
  if p_sale_price is null or p_sale_price < 0 or p_sale_price <> round(p_sale_price, 4)
    or p_cost_price is null or p_cost_price < 0 or p_cost_price <> round(p_cost_price, 4) then
    raise exception 'Invalid product prices' using errcode = '22023';
  end if;
  if p_sku is null or p_sku <> upper(btrim(p_sku)) or p_sku !~ '^[A-Z0-9][A-Z0-9._-]{0,79}$' then
    raise exception 'Invalid SKU' using errcode = '22023';
  end if;
  if p_barcode is not null and (
    p_barcode <> btrim(p_barcode) or char_length(p_barcode) not between 1 and 80
  ) then
    raise exception 'Invalid barcode' using errcode = '22023';
  end if;
  if p_attributes is null or jsonb_typeof(p_attributes) <> 'object' or p_active is null then
    raise exception 'Invalid variant data' using errcode = '22023';
  end if;
  if v_image is not null and (v_image !~ '^https?://' or char_length(v_image) > 800) then
    raise exception 'Invalid product image' using errcode = '22023';
  end if;
  if p_category_id is not null and not exists (
    select 1 from public.categories where tenant_id = p_tenant_id and id = p_category_id
  ) then
    raise exception 'Category not found' using errcode = '22023';
  end if;

  if p_product_id is null then
    if p_variant_id is not null then
      raise exception 'Unexpected variant identifier' using errcode = '22023';
    end if;
    insert into public.products(
      tenant_id, category_id, name, description, sale_price, cost_price, active, image_url
    ) values (
      p_tenant_id, p_category_id, p_name, nullif(p_description, ''), p_sale_price, p_cost_price, p_active, v_image
    ) returning * into saved_product;

    insert into public.product_variants(
      tenant_id, product_id, sku, barcode, attributes, active
    ) values (
      p_tenant_id, saved_product.id, p_sku, nullif(p_barcode, ''), p_attributes, p_active
    ) returning * into saved_variant;
  else
    if p_variant_id is null then
      raise exception 'Variant identifier required' using errcode = '22023';
    end if;
    update public.products
    set category_id = p_category_id,
        name = p_name,
        description = nullif(p_description, ''),
        sale_price = p_sale_price,
        cost_price = p_cost_price,
        active = p_active,
        image_url = v_image
    where tenant_id = p_tenant_id and id = p_product_id
    returning * into saved_product;
    if not found then
      raise exception 'Product not found' using errcode = '22023';
    end if;

    update public.product_variants
    set sku = p_sku,
        barcode = nullif(p_barcode, ''),
        attributes = p_attributes,
        active = p_active
    where tenant_id = p_tenant_id and id = p_variant_id and product_id = p_product_id
    returning * into saved_variant;
    if not found then
      raise exception 'Variant not found' using errcode = '22023';
    end if;
  end if;

  return jsonb_build_object('product', to_jsonb(saved_product), 'variant', to_jsonb(saved_variant));
end;
$$;

revoke all on function public.upsert_product(
  uuid, uuid, uuid, uuid, text, text, numeric, numeric, text, text, jsonb, boolean, text
) from public;
grant execute on function public.upsert_product(
  uuid, uuid, uuid, uuid, text, text, numeric, numeric, text, text, jsonb, boolean, text
) to authenticated;

-- 4. La vitrine publique expose la photo (nouvelle forme : on remplace).
drop function if exists public.storefront_catalog(text);

create function public.storefront_catalog(p_slug text)
returns table (
  product_id uuid,
  variant_id uuid,
  name text,
  description text,
  sku text,
  category_name text,
  unit_price numeric,
  available numeric,
  currency_code text,
  image_url text
)
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
    return;
  end if;

  select * into v_tenant from public.tenants where id = v_settings.tenant_id;
  if not found or v_tenant.status <> 'active' then
    return;
  end if;

  return query
    select
      product.id,
      variant.id,
      product.name::text,
      coalesce(product.description, '')::text,
      variant.sku::text,
      coalesce(category.name, '')::text,
      round(product.sale_price, 4),
      round(coalesce(sum(balance.on_hand - balance.reserved), 0), 4),
      v_tenant.currency_code::text,
      product.image_url::text
    from public.products as product
    join public.product_variants as variant
      on variant.product_id = product.id and variant.tenant_id = product.tenant_id
    left join public.categories as category
      on category.id = product.category_id and category.tenant_id = product.tenant_id
    left join public.stock_balances as balance
      on balance.tenant_id = product.tenant_id
     and balance.variant_id = variant.id
     and (v_settings.default_location_id is null or balance.location_id = v_settings.default_location_id)
    where product.tenant_id = v_settings.tenant_id
      and product.active
      and variant.active
    group by product.id, variant.id, category.name, v_tenant.currency_code
    having coalesce(sum(balance.on_hand - balance.reserved), 0) > 0
    order by product.name, variant.sku;
end;
$$;

revoke all on function public.storefront_catalog(text) from public;
grant execute on function public.storefront_catalog(text) to authenticated, anon;

commit;

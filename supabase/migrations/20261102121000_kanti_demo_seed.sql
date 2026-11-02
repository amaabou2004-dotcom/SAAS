-- Kanti — données de démonstration (catalogue, fournisseurs, stock initial, historique)

create or replace function public.seed_demo_data(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_location_id uuid;
  v_supplier_id uuid;
  v_category_id uuid;
  v_product_id uuid;
  v_variant_id uuid;
  v_row record;
  v_suppliers jsonb := '[
    {"name":"Grand Marché Distribution","contact":"Abdou Salam","phone":"+227 90 12 34 56","email":"contact@gmd-niger.com","city":"Niamey","lead":3,"notes":"Livraison lundi et jeudi. Paiement à 15 jours."},
    {"name":"Niger Boissons SA","contact":"Fatima Oumarou","phone":"+227 96 44 21 10","email":"commandes@nigerboissons.ne","city":"Niamey","lead":2,"notes":"Dépôt de Yantala."},
    {"name":"Sahel Hygiène & Entretien","contact":"Rachid Alassane","phone":"+227 87 65 43 21","email":null,"city":"Niamey","lead":5,"notes":"Commande minimum 150 000 FCFA."},
    {"name":"Import Afrique Ouest","contact":"Chantal Koffi","phone":"+228 90 88 77 66","email":"proforma@iao-togo.com","city":"Lomé","lead":12,"notes":"Import conteneur — prévoir les délais douane."},
    {"name":"Coopérative Agricole Tillabéri","contact":"Hamidou Djibo","phone":"+227 91 23 45 67","email":null,"city":"Tillabéri","lead":7,"notes":"Mil, sorgho et niébé de saison."}
  ]'::jsonb;
  v_opening jsonb := '[]'::jsonb;
  v_products integer := 0;
begin
  if (select auth.uid()) is null
    or not public.has_tenant_permission(p_tenant_id, 'catalog.manage')
    or not public.has_tenant_permission(p_tenant_id, 'inventory.manage') then
    raise exception 'Catalog and inventory management permissions required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id and status = 'active') then
    raise exception 'Active tenant required' using errcode = '42501';
  end if;
  if exists (select 1 from public.products where tenant_id = p_tenant_id) then
    raise exception 'Demo data can only be loaded into an empty catalog' using errcode = '22023';
  end if;

  select id into v_location_id
  from public.stock_locations
  where tenant_id = p_tenant_id
  order by created_at
  limit 1;

  if v_location_id is null then
    insert into public.stock_locations(tenant_id, name, code)
    values (p_tenant_id, 'Dépôt principal', 'PRINCIPAL')
    returning id into v_location_id;
  end if;

  -- Fournisseurs
  for v_row in select * from jsonb_to_recordset(v_suppliers)
    as supplier(name text, contact text, phone text, email text, city text, lead integer, notes text)
  loop
    insert into public.suppliers(tenant_id, name, contact, phone, email, city, lead_time_days, notes)
    values (p_tenant_id, v_row.name, v_row.contact, v_row.phone, v_row.email, v_row.city, v_row.lead, v_row.notes)
    on conflict (tenant_id, name) do nothing;
  end loop;

  -- Catégories
  insert into public.categories(tenant_id, name)
  select p_tenant_id, category_name
  from unnest(array[
    'Céréales & farines', 'Boissons', 'Alimentation', 'Hygiène',
    'Entretien', 'Électricité', 'Papeterie', 'Cosmétiques', 'Divers'
  ]) as category_name
  on conflict do nothing;

  -- Produits
  for v_row in
    select * from (values
      ('RIZ-25', '6191234500011', 'Riz parfumé 25 kg', 'Céréales & farines', 'sac', 17500, 19500, 42, 20, 40, 'Coopérative Agricole Tillabéri', 'Rayon A1'),
      ('MIL-50', '6191234500028', 'Mil local 50 kg', 'Céréales & farines', 'sac', 22000, 25000, 8, 12, 25, 'Coopérative Agricole Tillabéri', 'Rayon A2'),
      ('SORGHO-50', '6191234500035', 'Sorgho 50 kg', 'Céréales & farines', 'sac', 18000, 21000, 0, 10, 20, 'Coopérative Agricole Tillabéri', 'Rayon A2'),
      ('FARINE-50', '6191234500042', 'Farine de blé 50 kg', 'Céréales & farines', 'sac', 24000, 27500, 17, 10, 20, 'Grand Marché Distribution', 'Rayon A3'),
      ('HUILE-5L', '6191234500059', 'Huile végétale 5 L', 'Alimentation', 'bidon', 5800, 6700, 64, 30, 48, 'Grand Marché Distribution', 'Rayon B1'),
      ('SUCRE-1K', '6191234500066', 'Sucre en morceaux 1 kg', 'Alimentation', 'paquet', 700, 850, 120, 60, 100, 'Grand Marché Distribution', 'Rayon B2'),
      ('LAIT-500', '6191234500073', 'Lait en poudre 500 g', 'Alimentation', 'boîte', 2400, 2900, 36, 40, 60, 'Grand Marché Distribution', 'Rayon B2'),
      ('THE-400', '6191234500080', 'Thé vert 400 g', 'Boissons', 'paquet', 1900, 2400, 78, 40, 60, 'Grand Marché Distribution', 'Rayon C1'),
      ('CAFE-100', '6191234500097', 'Café soluble 100 g', 'Boissons', 'boîte', 1500, 1950, 25, 24, 48, 'Grand Marché Distribution', 'Rayon C1'),
      ('EAU-15L', '6191234500103', 'Eau minérale 1,5 L', 'Boissons', 'pack', 1400, 1800, 95, 50, 100, 'Niger Boissons SA', 'Réserve'),
      ('ENERG-33', '6191234500110', 'Boisson énergisante 33 cl', 'Boissons', 'carton', 7500, 9000, 24, 15, 30, 'Niger Boissons SA', 'Rayon C2'),
      ('JUS-1L', '6191234500127', 'Jus d''orange 1 L', 'Boissons', 'bouteille', 850, 1150, 54, 36, 72, 'Niger Boissons SA', 'Rayon C2'),
      ('SODA-33', '6191234500134', 'Soda cola 33 cl', 'Boissons', 'carton', 5200, 6500, 31, 20, 40, 'Niger Boissons SA', 'Rayon C2'),
      ('PATES-500', '6191234500141', 'Pâtes alimentaires 500 g', 'Alimentation', 'paquet', 450, 600, 210, 100, 150, 'Grand Marché Distribution', 'Rayon B3'),
      ('TOMATE-70', '6191234500158', 'Tomate concentrée 70 g', 'Alimentation', 'boîte', 180, 250, 320, 150, 300, 'Grand Marché Distribution', 'Rayon B3'),
      ('SARDINE-125', '6191234500165', 'Sardines à l''huile 125 g', 'Alimentation', 'boîte', 550, 750, 96, 80, 120, 'Grand Marché Distribution', 'Rayon B3'),
      ('SAVON-MAR', '6191234500172', 'Savon de Marseille 400 g', 'Hygiène', 'pièce', 350, 500, 180, 100, 200, 'Sahel Hygiène & Entretien', 'Rayon D1'),
      ('DETERG-1K', '6191234500189', 'Détergent lessive 1 kg', 'Entretien', 'sachet', 950, 1250, 42, 50, 80, 'Sahel Hygiène & Entretien', 'Rayon D2'),
      ('JAVEL-1L', '6191234500196', 'Eau de javel 1 L', 'Entretien', 'bouteille', 400, 600, 68, 40, 72, 'Sahel Hygiène & Entretien', 'Rayon D2'),
      ('VAISSELLE-1L', '6191234500202', 'Liquide vaisselle 1 L', 'Entretien', 'bouteille', 900, 1200, 19, 24, 36, 'Sahel Hygiène & Entretien', 'Rayon D2'),
      ('EPONGE-3', '6191234500219', 'Éponges (lot de 3)', 'Entretien', 'paquet', 250, 400, 140, 60, 100, 'Sahel Hygiène & Entretien', 'Rayon D3'),
      ('PAPIER-HYG', '6191234500226', 'Papier hygiénique (4 rouleaux)', 'Hygiène', 'pack', 900, 1300, 57, 36, 60, 'Sahel Hygiène & Entretien', 'Rayon D3'),
      ('PILES-AA', '6191234500233', 'Piles AA (lot de 4)', 'Électricité', 'pack', 1200, 1800, 33, 20, 40, 'Import Afrique Ouest', 'Rayon E1'),
      ('AMPOULE-9W', '6191234500240', 'Ampoule LED 9 W', 'Électricité', 'pièce', 700, 1200, 6, 24, 50, 'Import Afrique Ouest', 'Rayon E1'),
      ('CABLE-25', '6191234500257', 'Câble électrique 2,5 mm²', 'Électricité', 'rouleau', 14500, 17500, 11, 6, 10, 'Import Afrique Ouest', 'Réserve'),
      ('CAHIER-200', '6191234500264', 'Cahier 200 pages', 'Papeterie', 'pièce', 300, 450, 240, 100, 200, 'Import Afrique Ouest', 'Rayon F1'),
      ('STYLO-B', '6191234500271', 'Stylos bleus (boîte de 50)', 'Papeterie', 'boîte', 3750, 5000, 14, 10, 20, 'Import Afrique Ouest', 'Rayon F1'),
      ('RAMETTE-A4', '6191234500288', 'Ramette A4 (500 feuilles)', 'Papeterie', 'ramette', 3200, 4000, 0, 12, 24, 'Import Afrique Ouest', 'Rayon F2'),
      ('PARFUM-50', '6191234500295', 'Eau de toilette 50 ml', 'Cosmétiques', 'pièce', 3500, 5500, 22, 12, 24, 'Import Afrique Ouest', 'Rayon G1'),
      ('LAIT-CORPS', '6191234500301', 'Lait corporel 400 ml', 'Cosmétiques', 'pièce', 1800, 2600, 41, 18, 36, 'Sahel Hygiène & Entretien', 'Rayon G1'),
      ('BOUGIE-6', '6191234500318', 'Bougies (lot de 6)', 'Divers', 'paquet', 600, 900, 88, 40, 80, 'Import Afrique Ouest', 'Rayon H1'),
      ('ALLUMETTE', '6191234500325', 'Allumettes (carton de 10)', 'Divers', 'carton', 250, 400, 64, 30, 60, 'Import Afrique Ouest', 'Rayon H1'),
      ('SAC-PLAST', '6191234500332', 'Sacs plastiques (paquet de 100)', 'Divers', 'paquet', 500, 800, 210, 80, 150, 'Import Afrique Ouest', 'Réserve')
    ) as demo(sku, barcode, name, category_name, unit, cost, price, stock, reorder_point, reorder_qty, supplier_name, storage)
  loop
    select id into v_category_id
    from public.categories
    where tenant_id = p_tenant_id and name = v_row.category_name;

    select id into v_supplier_id
    from public.suppliers
    where tenant_id = p_tenant_id and name = v_row.supplier_name;

    insert into public.products(tenant_id, category_id, name, sale_price, cost_price, supplier_id)
    values (p_tenant_id, v_category_id, v_row.name, v_row.price, v_row.cost, v_supplier_id)
    returning id into v_product_id;

    insert into public.product_variants(
      tenant_id, product_id, sku, barcode, unit, reorder_point, reorder_qty, storage_label
    ) values (
      p_tenant_id, v_product_id, v_row.sku, v_row.barcode, v_row.unit,
      v_row.reorder_point, v_row.reorder_qty, v_row.storage
    ) returning id into v_variant_id;

    if v_row.stock > 0 then
      v_opening := v_opening || jsonb_build_object(
        'variant_id', v_variant_id,
        'location_id', v_location_id,
        'quantity_delta', v_row.stock
      );
    end if;
    v_products := v_products + 1;
  end loop;

  if jsonb_array_length(v_opening) > 0 then
    perform public.post_stock_operation(
      p_tenant_id,
      'opening',
      'kanti-demo-opening-' || replace(p_tenant_id::text, '-', ''),
      'Stock initial de démonstration',
      'DEMO',
      v_opening,
      null
    );
  end if;

  return jsonb_build_object('products', v_products, 'suppliers', jsonb_array_length(v_suppliers));
end;
$function$;

create or replace function public.seed_demo_history(p_tenant_id uuid, p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_location_id uuid;
  v_day integer;
  v_variant record;
  v_qty numeric;
  v_balance numeric;
  v_operation_id uuid;
  v_created timestamptz;
  v_count integer := 0;
begin
  if (select auth.uid()) is null or not public.has_tenant_permission(p_tenant_id, 'inventory.manage') then
    raise exception 'Inventory management permission required' using errcode = '42501';
  end if;
  if p_days < 1 or p_days > 120 then
    raise exception 'History days must be between 1 and 120' using errcode = '22023';
  end if;
  if not exists (select 1 from public.products where tenant_id = p_tenant_id) then
    raise exception 'Seed the demo catalog first' using errcode = '22023';
  end if;

  select id into v_location_id
  from public.stock_locations
  where tenant_id = p_tenant_id
  order by created_at
  limit 1;

  for v_day in 0..p_days - 1 loop
    for v_variant in
      select variant.id, variant.reorder_qty
      from public.product_variants as variant
      where variant.tenant_id = p_tenant_id and variant.active
    loop
      v_created := date_trunc('day', now()) - (v_day || ' days')::interval
        + ((8 + floor(random() * 10)) || ' hours')::interval;

      if random() < 0.16 then
        select on_hand into v_balance
        from public.stock_balances
        where tenant_id = p_tenant_id and variant_id = v_variant.id and location_id = v_location_id;

        v_qty := greatest(1, round((0.05 + random() * 0.2) * greatest(v_variant.reorder_qty, 4)));

        if coalesce(v_balance, 0) >= v_qty then
          insert into public.stock_operations(
            tenant_id, operation_type, idempotency_key, request_fingerprint,
            actor_user_id, reason, reference, created_at
          ) values (
            p_tenant_id, 'issue', 'hist-' || gen_random_uuid()::text, md5(gen_random_uuid()::text),
            (select auth.uid()), 'Vente comptoir', 'VTE-' || floor(random() * 8000 + 1000)::text, v_created
          ) returning id into v_operation_id;

          insert into public.stock_movements(
            tenant_id, operation_id, variant_id, location_id, quantity_delta, on_hand_after, reserved_after, created_at
          ) values (
            p_tenant_id, v_operation_id, v_variant.id, v_location_id, -v_qty, v_balance - v_qty, 0, v_created
          );

          update public.stock_balances
          set on_hand = on_hand - v_qty, updated_at = v_created
          where tenant_id = p_tenant_id and variant_id = v_variant.id and location_id = v_location_id;

          v_count := v_count + 1;
        end if;
      end if;

      if random() < 0.03 then
        select on_hand into v_balance
        from public.stock_balances
        where tenant_id = p_tenant_id and variant_id = v_variant.id and location_id = v_location_id;

        v_qty := greatest(1, round(v_variant.reorder_qty * (0.5 + random() * 0.6)));

        insert into public.stock_operations(
          tenant_id, operation_type, idempotency_key, request_fingerprint,
          actor_user_id, reason, reference, created_at
        ) values (
          p_tenant_id, 'receipt', 'hist-' || gen_random_uuid()::text, md5(gen_random_uuid()::text),
          (select auth.uid()), 'Réception fournisseur', 'REC-' || floor(random() * 2000 + 500)::text, v_created
        ) returning id into v_operation_id;

        insert into public.stock_movements(
          tenant_id, operation_id, variant_id, location_id, quantity_delta, on_hand_after, reserved_after, created_at
        ) values (
          p_tenant_id, v_operation_id, v_variant.id, v_location_id, v_qty, coalesce(v_balance, 0) + v_qty, 0, v_created
        );

        update public.stock_balances
        set on_hand = on_hand + v_qty, updated_at = v_created
        where tenant_id = p_tenant_id and variant_id = v_variant.id and location_id = v_location_id;

        v_count := v_count + 1;
      end if;
    end loop;
  end loop;

  return v_count;
end;
$function$;

revoke all on function public.seed_demo_data(uuid) from public;
revoke all on function public.seed_demo_history(uuid, integer) from public;
grant execute on function public.seed_demo_data(uuid) to authenticated;
grant execute on function public.seed_demo_history(uuid, integer) to authenticated;

notify pgrst, 'reload schema';

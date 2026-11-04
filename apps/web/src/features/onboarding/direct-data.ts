import { getSupabaseClient } from '../../lib/supabase';

/**
 * Traduction directe des routes de l'API NestJS en requêtes Supabase.
 *
 * Le front n'utilise qu'un seul point d'entrée HTTP (`apiFetch`) ; en mode
 * `direct`, ce module répond aux mêmes routes avec les mêmes formes de données,
 * mais les requêtes partent du navigateur vers PostgREST / les RPC.
 *
 * Les règles restent côté base :
 * - lecture : RLS (`is_tenant_member`, `has_tenant_permission`) ;
 * - écriture : uniquement via les fonctions `security definer`
 *   (`create_tenant`, `upsert_category`, `upsert_product`,
 *   `upsert_stock_location`, `post_stock_operation`).
 */

export type DirectResult = {
  data: unknown;
  error: { message: string } | null;
};

export type DirectQuery = {
  select: (columns: string) => DirectQuery;
  eq: (column: string, value: unknown) => DirectQuery;
  order: (column: string, options?: { ascending?: boolean }) => DirectQuery;
  limit: (count: number) => DirectQuery;
  then: <T>(onFulfilled: (value: DirectResult) => T | PromiseLike<T>) => Promise<T>;
};

export type DirectClient = {
  from: (table: string) => DirectQuery;
  rpc: (name: string, args: Record<string, unknown>) => Promise<DirectResult>;
};

type Payload = Record<string, unknown>;

function asRows(value: unknown): Payload[] {
  return Array.isArray(value) ? (value as Payload[]) : [];
}

function asRow(value: unknown): Payload {
  return (value ?? {}) as Payload;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(message: string | undefined, fallback: string): never {
  throw new Error(message?.trim() || fallback);
}

function asNumber(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value) : (value as number);
  return Number.isFinite(parsed) ? Number(parsed) : 0;
}

function parseBody(init?: RequestInit): Payload {
  if (!init?.body || typeof init.body !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(init.body);
    return parsed && typeof parsed === 'object' ? (parsed as Payload) : {};
  } catch {
    throw new Error('Requête invalide.');
  }
}

type RouteContext = {
  client: DirectClient;
  method: string;
  body: Payload;
  idempotencyKey: string | null;
};

function toCategory(row: Payload) {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    name: row.name as string,
    active: Boolean(row.active),
  };
}

function toLocation(row: Payload) {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    name: row.name as string,
    code: row.code as string,
    active: Boolean(row.active),
  };
}

function toTenant(row: Payload) {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    currency_code: row.currency_code as string,
    timezone: row.timezone as string,
    status: row.status as string,
    created_at: row.created_at as string,
  };
}

function toStock(row: Payload) {
  return {
    tenant_id: row.tenant_id as string,
    variant_id: row.variant_id as string,
    location_id: row.location_id as string,
    product_id: row.product_id as string,
    product_name: row.product_name as string,
    sku: row.sku as string,
    location_name: row.location_name as string,
    location_code: row.location_code as string,
    on_hand: asNumber(row.on_hand),
    reserved: asNumber(row.reserved),
    available: asNumber(row.available),
    updated_at: row.updated_at as string,
  };
}

function toMovement(row: Payload) {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    operation_id: row.operation_id as string,
    operation_type: row.operation_type as string,
    operation_status: row.operation_status as string,
    actor_user_id: row.actor_user_id as string,
    reason: (row.reason as string | null) ?? null,
    reference: (row.reference as string | null) ?? null,
    reverses_operation_id: (row.reverses_operation_id as string | null) ?? null,
    variant_id: row.variant_id as string,
    location_id: row.location_id as string,
    product_id: row.product_id as string,
    product_name: row.product_name as string,
    sku: row.sku as string,
    location_name: row.location_name as string,
    location_code: row.location_code as string,
    quantity_delta: asNumber(row.quantity_delta),
    on_hand_after: asNumber(row.on_hand_after),
    reserved_after: asNumber(row.reserved_after),
    created_at: row.created_at as string,
  };
}

const SALE_COLUMNS = [
  'id, tenant_id, number, status, location_id, location_name, payment_method, payment_reference,',
  'customer_name, note, subtotal, total, total_cost, margin, item_count, created_at, voided_at',
].join(' ');

const SALE_ITEM_COLUMNS =
  'id, sale_id, variant_id, product_name, sku, unit_price, unit_cost, quantity, line_total';

function toSale(row: Payload) {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    number: row.number as string,
    status: row.status as string,
    location_id: row.location_id as string,
    location_name: row.location_name as string,
    payment_method: row.payment_method as string,
    payment_reference: (row.payment_reference as string | null) ?? null,
    customer_name: (row.customer_name as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    subtotal: asNumber(row.subtotal),
    total: asNumber(row.total),
    total_cost: asNumber(row.total_cost),
    margin: asNumber(row.margin),
    item_count: asNumber(row.item_count),
    created_at: row.created_at as string,
    voided_at: (row.voided_at as string | null) ?? null,
  };
}

function toSaleItem(row: Payload) {
  return {
    id: row.id as string,
    sale_id: row.sale_id as string,
    variant_id: row.variant_id as string,
    product_name: row.product_name as string,
    sku: row.sku as string,
    unit_price: asNumber(row.unit_price),
    unit_cost: asNumber(row.unit_cost),
    quantity: asNumber(row.quantity),
    line_total: asNumber(row.line_total),
  };
}

function toMember(row: Payload) {
  return {
    membership_id: row.membership_id as string,
    user_id: row.user_id as string,
    full_name: asText(row.full_name),
    email: asText(row.email),
    role_id: row.role_id as string,
    role_name: asText(row.role_name),
    status: row.status as string,
    created_at: row.created_at as string,
  };
}

function toRole(row: Payload) {
  return {
    id: row.id as string,
    name: row.name as string,
    description: asText(row.description),
    is_system: Boolean(row.is_system),
    permissions: Array.isArray(row.permissions) ? (row.permissions as string[]) : [],
    member_count: asNumber(row.member_count),
  };
}

function toInvitation(row: Payload) {
  return {
    id: row.id as string,
    email: asText(row.email),
    full_name: asText(row.full_name),
    role_id: row.role_id as string,
    role_name: asText(row.role_name),
    status: row.status as string,
    created_at: row.created_at as string,
    expires_at: row.expires_at as string,
    token: row.token as string,
  };
}

async function listTenants({ client }: RouteContext) {
  const { data, error } = await client
    .from('tenants')
    .select('id, name, slug, currency_code, timezone, status, created_at')
    .order('created_at', { ascending: true });

  if (error) fail(error.message, 'Impossible de charger vos entreprises.');
  return asRows(data).map(toTenant);
}

async function createTenant({ client, body }: RouteContext) {
  const { data, error } = await client.rpc('create_tenant', {
    p_name: body.name,
    p_slug: body.slug,
    p_currency_code: body.currency_code,
    p_timezone: body.timezone,
  });

  if (error) fail(error.message, 'La création de l’entreprise a échoué.');
  return toTenant(asRow(data));
}

async function listCategories({ client }: RouteContext, tenantId: string) {
  const { data, error } = await client
    .from('categories')
    .select('id, tenant_id, name, active')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true });

  if (error) fail(error.message, 'Impossible de charger les catégories.');
  return asRows(data).map(toCategory);
}

async function saveCategory({ client, body }: RouteContext, tenantId: string, categoryId?: string) {
  const { data, error } = await client.rpc('upsert_category', {
    p_tenant_id: tenantId,
    p_category_id: categoryId ?? null,
    p_name: body.name,
    p_active: typeof body.active === 'boolean' ? body.active : true,
  });

  if (error) fail(error.message, 'La catégorie n’a pas pu être enregistrée.');
  return toCategory(asRow(data));
}

async function listProducts({ client }: RouteContext, tenantId: string) {
  const [productsRes, variantsRes, categoriesRes] = await Promise.all([
    client
      .from('products')
      .select('id, tenant_id, category_id, name, description, sale_price, cost_price, active, image_url')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true }),
    client
      .from('product_variants')
      .select('id, tenant_id, product_id, sku, barcode, attributes, active')
      .eq('tenant_id', tenantId),
    client.from('categories').select('id, tenant_id, name, active').eq('tenant_id', tenantId),
  ]);

  const error = productsRes.error ?? variantsRes.error ?? categoriesRes.error;
  if (error) fail(error.message, 'Impossible de charger le catalogue.');

  const categories = asRows(categoriesRes.data).map(toCategory);
  const variants = asRows(variantsRes.data);

  return asRows(productsRes.data).map((product) => ({
    id: product.id as string,
    tenant_id: product.tenant_id as string,
    category_id: (product.category_id as string | null) ?? null,
    name: product.name as string,
    description: (product.description as string | null) ?? null,
    sale_price: asNumber(product.sale_price),
    cost_price: asNumber(product.cost_price),
    active: Boolean(product.active),
    image_url: (product.image_url as string | null) ?? null,
    category: categories.find((category) => category.id === product.category_id) ?? null,
    variants: variants
      .filter((variant) => variant.product_id === product.id)
      .map((variant) => ({
        id: variant.id as string,
        tenant_id: variant.tenant_id as string,
        product_id: variant.product_id as string,
        sku: variant.sku as string,
        barcode: (variant.barcode as string | null) ?? null,
        attributes: (variant.attributes as Record<string, unknown> | null) ?? {},
        active: Boolean(variant.active),
      })),
  }));
}

async function saveProduct({ client, body }: RouteContext, tenantId: string, productId?: string) {
  const attributes =
    body.attributes && typeof body.attributes === 'object' ? (body.attributes as Record<string, unknown>) : {};

  // SKU vide : la base le fabrique elle-même (`generate_product_sku`).
  const sku = typeof body.sku === 'string' && body.sku.trim() ? body.sku.trim().toUpperCase() : null;
  // Quantité de départ : enregistrée par la base comme opération de stock
  // « opening », avec le même contrôle que l'écran Stock.
  const initialQuantity = asNumber(body.initial_quantity);

  const { data, error } = await client.rpc('upsert_product', {
    p_tenant_id: tenantId,
    p_product_id: productId ?? null,
    p_variant_id: typeof body.variant_id === 'string' && UUID.test(body.variant_id) ? body.variant_id : null,
    p_category_id: typeof body.category_id === 'string' && UUID.test(body.category_id) ? body.category_id : null,
    p_name: body.name,
    p_description: typeof body.description === 'string' && body.description.trim() ? body.description : null,
    p_sale_price: asNumber(body.sale_price),
    p_cost_price: asNumber(body.cost_price),
    p_sku: sku,
    p_barcode: typeof body.barcode === 'string' && body.barcode.trim() ? body.barcode.trim() : null,
    p_attributes: attributes,
    p_active: typeof body.active === 'boolean' ? body.active : true,
    // Photo déjà envoyée dans le bucket `product-images` : on n'enregistre que
    // son adresse (une chaîne vide efface la photo).
    p_image_url: body.image_url === null ? null : typeof body.image_url === 'string' && body.image_url.trim() ? body.image_url.trim() : null,
    p_initial_quantity: productId ? null : (Number.isFinite(initialQuantity) && initialQuantity > 0 ? initialQuantity : null),
    p_location_id: typeof body.location_id === 'string' && UUID.test(body.location_id) ? body.location_id : null,
  });

  if (error) fail(error.message, 'Le produit n’a pas pu être enregistré.');
  const saved = (data ?? {}) as { sku?: string; variant?: { sku?: string } };
  return { ok: true, sku: saved.sku ?? saved.variant?.sku ?? null };
}

async function listLocations({ client }: RouteContext, tenantId: string) {
  const { data, error } = await client
    .from('stock_locations')
    .select('id, tenant_id, name, code, active')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  if (error) fail(error.message, 'Impossible de charger les emplacements.');
  return asRows(data).map(toLocation);
}

async function saveLocation({ client, body }: RouteContext, tenantId: string, locationId?: string) {
  const { data, error } = await client.rpc('upsert_stock_location', {
    p_tenant_id: tenantId,
    p_location_id: locationId ?? null,
    p_name: body.name,
    p_code: body.code,
    p_active: typeof body.active === 'boolean' ? body.active : true,
  });

  if (error) fail(error.message, 'L’emplacement n’a pas pu être enregistré.');
  return toLocation(asRow(data));
}

async function listStock({ client }: RouteContext, tenantId: string) {
  const { data, error } = await client
    .from('stock_overview')
    .select(
      'tenant_id, variant_id, location_id, product_id, product_name, sku, location_name, location_code, on_hand, reserved, available, updated_at',
    )
    .eq('tenant_id', tenantId)
    .order('product_name', { ascending: true });

  if (error) fail(error.message, 'Impossible de charger les niveaux de stock.');
  return asRows(data).map(toStock);
}

async function listMovements({ client }: RouteContext, tenantId: string) {
  const { data, error } = await client
    .from('stock_movement_history')
    .select(
      'id, tenant_id, operation_id, operation_type, operation_status, actor_user_id, reason, reference, reverses_operation_id, variant_id, location_id, product_id, product_name, sku, location_name, location_code, quantity_delta, on_hand_after, reserved_after, created_at',
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) fail(error.message, 'Impossible de charger les mouvements.');
  return asRows(data).map(toMovement);
}

function operationLines(body: Payload) {
  const lines = Array.isArray(body.lines) ? body.lines : [];
  return lines.map((line) => {
    const row = line as Payload;
    return {
      variant_id: row.variant_id,
      location_id: row.location_id,
      quantity_delta: asNumber(row.quantity_delta),
    };
  });
}

async function postOperation({ client, body, idempotencyKey }: RouteContext, tenantId: string) {
  const { data, error } = await client.rpc('post_stock_operation', {
    p_tenant_id: tenantId,
    p_operation_type: body.operation_type,
    p_idempotency_key: idempotencyKey ?? `direct-${crypto.randomUUID()}`,
    p_reason: typeof body.reason === 'string' && body.reason.trim() ? body.reason : null,
    p_reference: typeof body.reference === 'string' && body.reference.trim() ? body.reference : null,
    p_lines: operationLines(body),
    p_reverses_operation_id: null,
  });

  if (error) fail(error.message, 'L’opération de stock a échoué.');
  return { id: asText(data) };
}

async function postReversal({ client, body, idempotencyKey }: RouteContext, tenantId: string, operationId: string) {
  const { data, error } = await client.rpc('post_stock_operation', {
    p_tenant_id: tenantId,
    p_operation_type: 'reversal',
    p_idempotency_key: idempotencyKey ?? `direct-rev-${crypto.randomUUID()}`,
    p_reason: typeof body.reason === 'string' && body.reason.trim() ? body.reason : null,
    p_reference: null,
    p_lines: [],
    p_reverses_operation_id: operationId,
  });

  if (error) fail(error.message, 'La contre-passation a échoué.');
  return { id: asText(data) };
}

async function readSale(client: DirectClient, tenantId: string, saleId: string) {
  const [saleRes, itemsRes] = await Promise.all([
    client
      .from('sales_overview')
      .select(SALE_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('id', saleId)
      .limit(1),
    client
      .from('sale_items')
      .select(SALE_ITEM_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('sale_id', saleId)
      .order('created_at', { ascending: true }),
  ]);

  const error = saleRes.error ?? itemsRes.error;
  if (error) fail(error.message, 'Impossible de charger la vente.');

  const sale = asRows(saleRes.data)[0];
  if (!sale) fail(undefined, 'Cette vente est introuvable.');

  return { ...toSale(sale), items: asRows(itemsRes.data).map(toSaleItem) };
}

async function listSales({ client }: RouteContext, tenantId: string) {
  const { data, error } = await client
    .from('sales_overview')
    .select(SALE_COLUMNS)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) fail(error.message, 'Impossible de charger les ventes.');
  return asRows(data).map(toSale);
}

function saleLines(body: Payload) {
  const items = Array.isArray(body.items) ? body.items : [];
  return items.map((line) => {
    const row = line as Payload;
    const quantity = asNumber(row.quantity);
    const unitPrice = row.unit_price === null || row.unit_price === undefined || row.unit_price === ''
      ? undefined
      : asNumber(row.unit_price);
    return {
      variant_id: row.variant_id,
      quantity,
      ...(unitPrice === undefined ? {} : { unit_price: unitPrice }),
    };
  });
}

async function createSale({ client, body, idempotencyKey }: RouteContext, tenantId: string) {
  const { data, error } = await client.rpc('post_sale', {
    p_tenant_id: tenantId,
    p_idempotency_key: idempotencyKey ?? `direct-vente-${crypto.randomUUID()}`,
    p_location_id: body.location_id,
    p_payment_method: body.payment_method,
    p_payment_reference: typeof body.payment_reference === 'string' && body.payment_reference.trim()
      ? body.payment_reference.trim()
      : null,
    p_customer_name: typeof body.customer_name === 'string' && body.customer_name.trim()
      ? body.customer_name.trim()
      : null,
    p_note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
    p_items: saleLines(body),
  });

  if (error) fail(error.message, 'La vente n’a pas pu être enregistrée.');
  return readSale(client, tenantId, asText(data));
}

async function voidSale({ client, body, idempotencyKey }: RouteContext, tenantId: string, saleId: string) {
  const { error } = await client.rpc('void_sale', {
    p_tenant_id: tenantId,
    p_sale_id: saleId,
    p_reason: typeof body.reason === 'string' ? body.reason.trim() : '',
    p_idempotency_key: idempotencyKey ?? `direct-annulation-${crypto.randomUUID()}`,
  });

  if (error) fail(error.message, 'L’annulation de la vente a échoué.');
  return readSale(client, tenantId, saleId);
}

async function listMembers({ client }: RouteContext, tenantId: string) {
  const { data, error } = await client.rpc('list_tenant_members', { p_tenant_id: tenantId });
  if (error) fail(error.message, 'Impossible de charger l’équipe.');
  return asRows(data).map(toMember);
}

async function listRoles({ client }: RouteContext, tenantId: string) {
  const { data, error } = await client.rpc('list_tenant_roles', { p_tenant_id: tenantId });
  if (error) fail(error.message, 'Impossible de charger les rôles.');
  return asRows(data).map(toRole);
}

async function listInvitations({ client }: RouteContext, tenantId: string) {
  const { data, error } = await client.rpc('list_tenant_invitations', { p_tenant_id: tenantId });
  if (error) fail(error.message, 'Impossible de charger les invitations.');
  return asRows(data).map(toInvitation);
}

async function inviteMember({ client, body }: RouteContext, tenantId: string) {
  const { data, error } = await client.rpc('invite_member', {
    p_tenant_id: tenantId,
    p_email: body.email,
    p_role_id: body.role_id,
    p_full_name: typeof body.full_name === 'string' && body.full_name.trim() ? body.full_name.trim() : null,
  });
  if (error) fail(error.message, 'L’invitation n’a pas pu être envoyée.');
  return asRow(data);
}

async function revokeInvitation({ client }: RouteContext, tenantId: string, invitationId: string) {
  const { error } = await client.rpc('revoke_invitation', {
    p_tenant_id: tenantId,
    p_invitation_id: invitationId,
  });
  if (error) fail(error.message, 'L’invitation n’a pas pu être annulée.');
  return { ok: true };
}

async function updateMemberRole({ client, body }: RouteContext, tenantId: string, membershipId: string) {
  const { error } = await client.rpc('update_member_role', {
    p_tenant_id: tenantId,
    p_membership_id: membershipId,
    p_role_id: body.role_id,
  });
  if (error) fail(error.message, 'Le rôle du membre n’a pas pu être modifié.');
  return { ok: true };
}

async function removeMember({ client }: RouteContext, tenantId: string, membershipId: string) {
  const { error } = await client.rpc('remove_member', {
    p_tenant_id: tenantId,
    p_membership_id: membershipId,
  });
  if (error) fail(error.message, 'Le membre n’a pas pu être retiré.');
  return { ok: true };
}

async function hasPermission({ client }: RouteContext, tenantId: string, permission: string) {
  const { data, error } = await client.rpc('has_tenant_permission', {
    target_tenant_id: tenantId,
    target_permission: permission,
  });
  if (error) fail(error.message, 'Impossible de vérifier vos droits.');
  return { allowed: data === true };
}

async function acceptMyInvitations({ client }: RouteContext) {
  const { data, error } = await client.rpc('accept_my_invitations', {});
  if (error) fail(error.message, 'Les invitations n’ont pas pu être acceptées.');
  const payload = asRow(data);
  return { accepted: asNumber(payload.accepted) };
}

async function reportSummary({ client }: RouteContext, tenantId: string, search: URLSearchParams) {
  const from = search.get('from');
  const to = search.get('to');
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error('Période de rapport invalide : dates attendues au format AAAA-MM-JJ.');
  }
  const { data, error } = await client.rpc('report_summary', {
    p_tenant_id: tenantId,
    p_from: from,
    p_to: to,
  });
  if (error) fail(error.message, 'Le rapport n’a pas pu être calculé.');
  return asRow(data);
}

function storefrontSlug(raw: string): string {
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(raw)) {
    throw new Error('Adresse de boutique invalide.');
  }
  return raw;
}

/* Boutique publique — accessible sans compte (rôles `anon` et `authenticated`). */

async function shopInfo({ client }: RouteContext, slug: string) {
  const { data, error } = await client.rpc('storefront_info', { p_slug: slug });
  if (error) fail(error.message, 'La boutique n’a pas pu être chargée.');
  return data ?? null;
}

async function shopCatalog({ client }: RouteContext, slug: string) {
  const { data, error } = await client.rpc('storefront_catalog', { p_slug: slug });
  if (error) fail(error.message, 'Le catalogue de la boutique n’a pas pu être chargé.');
  return asRows(data).map((row) => ({
    product_id: row.product_id as string,
    variant_id: row.variant_id as string,
    name: asText(row.name),
    description: (row.description as string | null) ?? null,
    sku: asText(row.sku),
    category_name: (row.category_name as string | null) ?? null,
    unit_price: asNumber(row.unit_price),
    available: asNumber(row.available),
    currency_code: asText(row.currency_code),
    image_url: (row.image_url as string | null) ?? null,
  }));
}

async function placeShopOrder({ client, body, idempotencyKey }: RouteContext, slug: string) {
  const items = Array.isArray(body.items) ? body.items : [];
  const { data, error } = await client.rpc('place_storefront_order', {
    p_slug: slug,
    p_idempotency_key: idempotencyKey ?? `boutique-${crypto.randomUUID()}`,
    p_customer_name: body.customer_name,
    p_customer_phone: body.customer_phone,
    p_note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
    // Le prix n'est jamais envoyé par le client : la base le recalcule.
    p_items: items.map((line) => {
      const row = line as Payload;
      return { variant_id: row.variant_id, quantity: asNumber(row.quantity) };
    }),
  });
  if (error) fail(error.message, 'La commande n’a pas pu être envoyée.');
  return asRow(data);
}

/* Alertes e-mail des commandes (gratuit : Brevo + pg_net côté base). */

async function notificationSettings({ client }: RouteContext, tenantId: string) {
  const { data, error } = await client.rpc('notification_settings_get', { p_tenant_id: tenantId });
  if (error) fail(error.message, 'Les réglages d’alerte e-mail n’ont pas pu être chargés.');
  return asRow(data);
}

async function saveNotificationSettings({ client, body }: RouteContext, tenantId: string) {
  const email = typeof body.recipient_email === 'string' && body.recipient_email.trim()
    ? body.recipient_email.trim()
    : null;
  const { data, error } = await client.rpc('notification_settings_save', {
    p_tenant_id: tenantId,
    p_recipient_email: email,
    p_enabled: body.enabled === true,
  });
  if (error) fail(error.message, 'L’adresse d’alerte n’a pas pu être enregistrée.');
  return asRow(data);
}

async function listNotifications({ client }: RouteContext, tenantId: string) {
  const { data, error } = await client.rpc('notifications_list', { p_tenant_id: tenantId, p_limit: 10 });
  if (error) fail(error.message, 'Les dernières alertes e-mail n’ont pas pu être chargées.');
  return asRows(data).map((row) => ({
    id: row.id as string,
    order_id: (row.order_id as string | null) ?? null,
    recipient_email: asText(row.recipient_email),
    subject: asText(row.subject),
    status: asText(row.status),
    attempts: asNumber(row.attempts),
    last_error: (row.last_error as string | null) ?? null,
    created_at: asText(row.created_at),
    sent_at: (row.sent_at as string | null) ?? null,
  }));
}

/* Boutique côté commerçant. */

async function storefrontSettings({ client }: RouteContext, tenantId: string) {
  const { data, error } = await client.rpc('storefront_settings_get', { p_tenant_id: tenantId });
  if (error) fail(error.message, 'La boutique n’a pas pu être chargée.');
  return asRow(data);
}

async function saveStorefrontSettings({ client, body }: RouteContext, tenantId: string) {
  const locationId = body.default_location_id;
  const { data, error } = await client.rpc('storefront_settings_save', {
    p_tenant_id: tenantId,
    p_slug: body.slug,
    p_display_name: typeof body.display_name === 'string' && body.display_name.trim() ? body.display_name.trim() : null,
    p_whatsapp: typeof body.whatsapp === 'string' && body.whatsapp.trim() ? body.whatsapp.trim() : null,
    p_published: body.published === true,
    p_default_location_id: typeof locationId === 'string' && UUID.test(locationId) ? locationId : null,
    p_logo_url: typeof body.logo_url === 'string' && body.logo_url.trim() ? body.logo_url.trim() : null,
  });
  if (error) fail(error.message, 'La boutique n’a pas pu être enregistrée.');
  return asRow(data);
}

async function listStorefrontOrders({ client }: RouteContext, tenantId: string) {
  const { data, error } = await client.rpc('storefront_orders_list', { p_tenant_id: tenantId });
  if (error) fail(error.message, 'Les commandes n’ont pas pu être chargées.');
  return asRows(data);
}

async function storefrontOrderAction(
  { client, body }: RouteContext,
  tenantId: string,
  orderId: string,
  action: string,
) {
  if (action === 'confirm') {
    const locationId = body.location_id;
    const { error } = await client.rpc('storefront_confirm_order', {
      p_tenant_id: tenantId,
      p_order_id: orderId,
      p_location_id: typeof locationId === 'string' && UUID.test(locationId) ? locationId : null,
    });
    if (error) fail(error.message, 'La commande n’a pas pu être confirmée.');
    return { ok: true };
  }

  if (action === 'cancel') {
    const { error } = await client.rpc('storefront_cancel_order', {
      p_tenant_id: tenantId,
      p_order_id: orderId,
      p_reason: typeof body.reason === 'string' ? body.reason.trim() : '',
    });
    if (error) fail(error.message, 'La commande n’a pas pu être annulée.');
    return { ok: true };
  }

  const { error } = await client.rpc('storefront_mark_delivered', {
    p_tenant_id: tenantId,
    p_order_id: orderId,
  });
  if (error) fail(error.message, 'La livraison n’a pas pu être enregistrée.');
  return { ok: true };
}

/** `true` quand la route est gérée par le mode direct (sinon on garde l'API). */
export function isDirectRoute(path: string): boolean {
  return new RegExp(
    [
      '^/tenants$',
      '^/tenants/me$',
      '^/tenants/[0-9a-f-]{36}/catalog/categories(/[0-9a-f-]{36})?$',
      '^/tenants/[0-9a-f-]{36}/catalog/products(/[0-9a-f-]{36})?$',
      '^/tenants/[0-9a-f-]{36}/inventory/locations(/[0-9a-f-]{36})?$',
      '^/tenants/[0-9a-f-]{36}/inventory/stock$',
      '^/tenants/[0-9a-f-]{36}/inventory/movements$',
      '^/tenants/[0-9a-f-]{36}/inventory/operations$',
      '^/tenants/[0-9a-f-]{36}/inventory/operations/[0-9a-f-]{36}/reversal$',
      '^/tenants/[0-9a-f-]{36}/sales$',
      '^/tenants/[0-9a-f-]{36}/sales/[0-9a-f-]{36}$',
      '^/tenants/[0-9a-f-]{36}/sales/[0-9a-f-]{36}/void$',
      '^/tenants/[0-9a-f-]{36}/members(/[0-9a-f-]{36})?$',
      '^/tenants/[0-9a-f-]{36}/roles$',
      '^/tenants/[0-9a-f-]{36}/invitations$',
      '^/tenants/[0-9a-f-]{36}/invitations/[0-9a-f-]{36}/revoke$',
      '^/tenants/[0-9a-f-]{36}/permissions/[a-z][a-z._]*$',
      '^/tenants/[0-9a-f-]{36}/reports([?][^#]*)?$',
      '^/shop/[a-z0-9][a-z0-9-]{1,38}[a-z0-9](/catalog|/orders)?$',
      '^/tenants/[0-9a-f-]{36}/storefront(/orders(/[0-9a-f-]{36}/(confirm|cancel|delivered))?)?$',
      '^/invitations/accept$',
    ].join('|'),
    'i',
  ).test(path);
}

export async function directApiFetch<T>(
  path: string,
  init: RequestInit | undefined,
  client: DirectClient = getSupabaseClient() as unknown as DirectClient,
): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const context: RouteContext = {
    client,
    method,
    body: parseBody(init),
    idempotencyKey: new Headers(init?.headers).get('Idempotency-Key'),
  };

  const [rawPath, rawQuery] = path.split('?');
  const search = new URLSearchParams(rawQuery ?? '');
  const segments = (rawPath ?? path).replace(/\/+$/, '').split('/').filter(Boolean);

  if (segments[0] === 'invitations' && segments[1] === 'accept') {
    if (method !== 'POST') throw new Error(`Route inconnue : ${path}`);
    return (await acceptMyInvitations(context)) as T;
  }
  if (segments[0] === 'shop') {
    const slug = storefrontSlug(segments[1] ?? '');
    if (segments.length === 2) return (await shopInfo(context, slug)) as T;
    if (segments.length === 3 && segments[2] === 'catalog') return (await shopCatalog(context, slug)) as T;
    if (segments.length === 3 && segments[2] === 'orders') {
      if (method !== 'POST') throw new Error(`Route inconnue : ${path}`);
      return (await placeShopOrder(context, slug)) as T;
    }
    throw new Error(`Route inconnue : ${path}`);
  }
  if (segments[0] !== 'tenants') throw new Error(`Route inconnue : ${path}`);
  if (segments[1] === 'me') return (await listTenants(context)) as T;
  if (segments.length === 1) {
    if (method === 'POST') return (await createTenant(context)) as T;
    return (await listTenants(context)) as T;
  }

  const tenantId = segments[1] ?? '';
  if (!UUID.test(tenantId)) throw new Error(`Entreprise invalide : ${tenantId || '(vide)'}`);

  const [, , scope, resource, resourceId, action] = segments;

  if (scope === 'catalog' && resource === 'categories') {
    if (!resourceId) {
      return (method === 'POST' ? await saveCategory(context, tenantId) : await listCategories(context, tenantId)) as T;
    }
    return (await saveCategory(context, tenantId, resourceId)) as T;
  }

  if (scope === 'catalog' && resource === 'products') {
    if (!resourceId) {
      return (method === 'POST' ? await saveProduct(context, tenantId) : await listProducts(context, tenantId)) as T;
    }
    return (await saveProduct(context, tenantId, resourceId)) as T;
  }

  if (scope === 'inventory' && resource === 'locations') {
    if (!resourceId) {
      return (method === 'POST' ? await saveLocation(context, tenantId) : await listLocations(context, tenantId)) as T;
    }
    return (await saveLocation(context, tenantId, resourceId)) as T;
  }

  if (scope === 'inventory' && resource === 'stock') {
    return (await listStock(context, tenantId)) as T;
  }

  if (scope === 'inventory' && resource === 'movements') {
    return (await listMovements(context, tenantId)) as T;
  }

  if (scope === 'inventory' && resource === 'operations') {
    if (action === 'reversal' && resourceId) {
      return (await postReversal(context, tenantId, resourceId)) as T;
    }
    return (await postOperation(context, tenantId)) as T;
  }

  if (scope === 'sales') {
    if (!resource) {
      return (method === 'POST' ? await createSale(context, tenantId) : await listSales(context, tenantId)) as T;
    }
    // `/tenants/{id}/sales/{saleId}/void` : le 5e segment est l'action.
    if (resourceId === 'void') {
      return (await voidSale(context, tenantId, resource)) as T;
    }
    if (resourceId) throw new Error(`Route inconnue : ${path}`);
    return (await readSale(context.client, tenantId, resource)) as T;
  }

  if (scope === 'members') {
    if (!resource) return (await listMembers(context, tenantId)) as T;
    if (method === 'DELETE') return (await removeMember(context, tenantId, resource)) as T;
    if (method === 'PATCH') return (await updateMemberRole(context, tenantId, resource)) as T;
    throw new Error(`Route inconnue : ${path}`);
  }

  if (scope === 'roles') {
    return (await listRoles(context, tenantId)) as T;
  }

  if (scope === 'invitations') {
    if (!resource) {
      return (method === 'POST' ? await inviteMember(context, tenantId) : await listInvitations(context, tenantId)) as T;
    }
    if (resourceId === 'revoke') return (await revokeInvitation(context, tenantId, resource)) as T;
    throw new Error(`Route inconnue : ${path}`);
  }

  if (scope === 'storefront') {
    if (!resource) {
      return (method === 'POST'
        ? await saveStorefrontSettings(context, tenantId)
        : await storefrontSettings(context, tenantId)) as T;
    }
    if (resource === 'orders') {
      if (!resourceId) return (await listStorefrontOrders(context, tenantId)) as T;
      if (action) return (await storefrontOrderAction(context, tenantId, resourceId, action)) as T;
    }
    throw new Error(`Route inconnue : ${path}`);
  }

  if (scope === 'notifications') {
    if (!resource) {
      return (method === 'PUT'
        ? await saveNotificationSettings(context, tenantId)
        : await notificationSettings(context, tenantId)) as T;
    }
    if (resource === 'history' && method === 'GET') {
      return (await listNotifications(context, tenantId)) as T;
    }
    throw new Error(`Route inconnue : ${path}`);
  }

  if (scope === 'reports') {
    return (await reportSummary(context, tenantId, search)) as T;
  }

  if (scope === 'permissions' && resource) {
    return (await hasPermission(context, tenantId, resource)) as T;
  }

  throw new Error(`Route inconnue : ${path}`);
}

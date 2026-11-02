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
      .select('id, tenant_id, category_id, name, description, sale_price, cost_price, active')
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

  const { error } = await client.rpc('upsert_product', {
    p_tenant_id: tenantId,
    p_product_id: productId ?? null,
    p_variant_id: typeof body.variant_id === 'string' && UUID.test(body.variant_id) ? body.variant_id : null,
    p_category_id: typeof body.category_id === 'string' && UUID.test(body.category_id) ? body.category_id : null,
    p_name: body.name,
    p_description: typeof body.description === 'string' && body.description.trim() ? body.description : null,
    p_sale_price: asNumber(body.sale_price),
    p_cost_price: asNumber(body.cost_price),
    p_sku: body.sku,
    p_barcode: typeof body.barcode === 'string' && body.barcode.trim() ? body.barcode.trim() : null,
    p_attributes: attributes,
    p_active: typeof body.active === 'boolean' ? body.active : true,
    p_supplier_id: null,
    p_unit: null,
    p_reorder_point: null,
    p_reorder_qty: null,
    p_storage_label: null,
  });

  if (error) fail(error.message, 'Le produit n’a pas pu être enregistré.');
  return { ok: true };
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

  const segments = path.replace(/\/+$/, '').split('/').filter(Boolean);

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

  throw new Error(`Route inconnue : ${path}`);
}

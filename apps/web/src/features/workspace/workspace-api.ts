import { z } from 'zod';
import { apiFetch } from '../onboarding/tenant-api';

const categorySchema = z.object({
  id: z.uuid(),
  tenant_id: z.uuid(),
  name: z.string(),
  active: z.boolean(),
});

const variantSchema = z.object({
  id: z.uuid(),
  tenant_id: z.uuid(),
  product_id: z.uuid(),
  sku: z.string(),
  barcode: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()),
  active: z.boolean(),
});

const productSchema = z.object({
  id: z.uuid(),
  tenant_id: z.uuid(),
  category_id: z.uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  sale_price: z.number(),
  cost_price: z.number(),
  active: z.boolean(),
  image_url: z.string().nullable(),
  category: categorySchema.nullable(),
  variants: z.array(variantSchema),
});

const locationSchema = z.object({
  id: z.uuid(),
  tenant_id: z.uuid(),
  name: z.string(),
  code: z.string(),
  active: z.boolean(),
});

const stockSchema = z.object({
  tenant_id: z.uuid(),
  variant_id: z.uuid(),
  location_id: z.uuid(),
  product_id: z.uuid(),
  product_name: z.string(),
  sku: z.string(),
  location_name: z.string(),
  location_code: z.string(),
  on_hand: z.number(),
  reserved: z.number(),
  available: z.number(),
  updated_at: z.string(),
});

const movementSchema = z.object({
  id: z.uuid(),
  tenant_id: z.uuid(),
  operation_id: z.uuid(),
  operation_type: z.string(),
  operation_status: z.string(),
  actor_user_id: z.uuid(),
  reason: z.string().nullable(),
  reference: z.string().nullable(),
  reverses_operation_id: z.uuid().nullable(),
  variant_id: z.uuid(),
  location_id: z.uuid(),
  product_id: z.uuid(),
  product_name: z.string(),
  sku: z.string(),
  location_name: z.string(),
  location_code: z.string(),
  quantity_delta: z.number(),
  on_hand_after: z.number(),
  reserved_after: z.number(),
  created_at: z.string(),
});

export type Category = z.infer<typeof categorySchema>;
export type Product = z.infer<typeof productSchema>;
export type Variant = z.infer<typeof variantSchema>;
export type StockLocation = z.infer<typeof locationSchema>;
export type StockBalance = z.infer<typeof stockSchema>;
export type StockMovement = z.infer<typeof movementSchema>;

export interface ProductInput {
  category_id: string | null;
  name: string;
  description: string | null;
  sale_price: string;
  cost_price: string;
  /** Vide : la base fabrique le SKU (voir `generate_product_sku`). */
  sku: string;
  barcode: string | null;
  attributes: Record<string, unknown>;
  image_url: string | null;
  /** Création seulement : quantité de départ, enregistrée comme stock d'ouverture. */
  initial_quantity?: string | null;
  /** Création seulement : emplacement qui reçoit le stock de départ. */
  location_id?: string | null;
}

export interface StockOperationInput {
  operation_type: 'opening' | 'receipt' | 'adjustment' | 'transfer';
  reason: string;
  reference: string | null;
  lines: Array<{
    variant_id: string;
    location_id: string;
    quantity_delta: string;
  }>;
}

const base = (tenantId: string) => `/tenants/${tenantId}`;

export async function listCategories(token: string, tenantId: string) {
  return z.array(categorySchema).parse(await apiFetch(`${base(tenantId)}/catalog/categories`, token));
}

export async function createCategory(token: string, tenantId: string, name: string) {
  return categorySchema.parse(await apiFetch(`${base(tenantId)}/catalog/categories`, token, {
    method: 'POST', body: JSON.stringify({ name }),
  }));
}

export async function setCategoryActive(token: string, tenantId: string, category: Category, active: boolean) {
  return categorySchema.parse(await apiFetch(`${base(tenantId)}/catalog/categories/${category.id}`, token, {
    method: 'PATCH', body: JSON.stringify({ name: category.name, active }),
  }));
}

export async function listProducts(token: string, tenantId: string) {
  return z.array(productSchema).parse(await apiFetch(`${base(tenantId)}/catalog/products`, token));
}

export async function saveProduct(token: string, tenantId: string, input: ProductInput, existing?: Product) {
  const path = existing ? `/catalog/products/${existing.id}` : '/catalog/products';
  const payload = await apiFetch<unknown>(`${base(tenantId)}${path}`, token, {
    method: existing ? 'PATCH' : 'POST',
    body: JSON.stringify({
      ...input,
      ...(existing ? { active: existing.active, variant_id: existing.variants[0]?.id } : {}),
    }),
  });
  // La base renvoie la fiche enregistrée : on récupère le SKU réellement attribué
  // (utile quand il a été fabriqué automatiquement).
  const parsed = z.object({ sku: z.string().optional() }).safeParse(payload);
  return { sku: parsed.success ? (parsed.data.sku ?? null) : null };
}

export async function setProductActive(token: string, tenantId: string, product: Product, active: boolean) {
  const variant = product.variants[0];
  if (!variant) throw new Error('Ce produit n’a pas de variante à modifier.');
  await apiFetch(`${base(tenantId)}/catalog/products/${product.id}`, token, {
    method: 'PATCH',
    body: JSON.stringify({
      category_id: product.category_id,
      name: product.name,
      description: product.description,
      sale_price: String(product.sale_price),
      cost_price: String(product.cost_price),
      sku: variant.sku,
      barcode: variant.barcode,
      attributes: variant.attributes,
      image_url: product.image_url,
      active,
      variant_id: variant.id,
    }),
  });
}

export async function listLocations(token: string, tenantId: string) {
  return z.array(locationSchema).parse(await apiFetch(`${base(tenantId)}/inventory/locations`, token));
}

export async function createLocation(token: string, tenantId: string, input: { name: string; code: string }) {
  return locationSchema.parse(await apiFetch(`${base(tenantId)}/inventory/locations`, token, {
    method: 'POST', body: JSON.stringify(input),
  }));
}

export async function listStock(token: string, tenantId: string) {
  return z.array(stockSchema).parse(await apiFetch(`${base(tenantId)}/inventory/stock`, token));
}

export async function listMovements(token: string, tenantId: string) {
  return z.array(movementSchema).parse(await apiFetch(`${base(tenantId)}/inventory/movements`, token));
}

export async function postStockOperation(token: string, tenantId: string, input: StockOperationInput, key: string) {
  const payload = await apiFetch<{ id: string }>(`${base(tenantId)}/inventory/operations`, token, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(input),
  });
  return z.object({ id: z.uuid() }).parse(payload);
}

export async function reverseStockOperation(token: string, tenantId: string, operationId: string, reason: string, key: string) {
  const payload = await apiFetch<{ id: string }>(`${base(tenantId)}/inventory/operations/${operationId}/reversal`, token, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ reason }),
  });
  return z.object({ id: z.uuid() }).parse(payload);
}

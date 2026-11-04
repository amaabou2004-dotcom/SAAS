import { z } from 'zod';
import { apiFetch } from '../onboarding/tenant-api';

/**
 * Boutique publique : le client n'a pas de compte.
 * Les routes `/shop/...` répondent en mode `anon` (fonctions `security definer`).
 */
const shopInfoSchema = z.object({
  slug: z.string(),
  display_name: z.string(),
  whatsapp: z.string().nullable(),
  currency_code: z.string(),
  timezone: z.string(),
  tenant_name: z.string(),
});

const shopItemSchema = z.object({
  product_id: z.uuid(),
  variant_id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  sku: z.string(),
  category_name: z.string().nullable(),
  unit_price: z.number(),
  available: z.number(),
  currency_code: z.string(),
  image_url: z.string().nullable(),
});

const shopOrderReceiptSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  total: z.number(),
  item_count: z.number(),
  status: z.string(),
});

export type ShopInfo = z.infer<typeof shopInfoSchema>;
export type ShopItem = z.infer<typeof shopItemSchema>;
export type ShopOrderReceipt = z.infer<typeof shopOrderReceiptSchema>;

export interface ShopOrderInput {
  customer_name: string;
  customer_phone: string;
  note: string | null;
  items: Array<{ variant_id: string; quantity: number }>;
}

/** Adresse de boutique : minuscules, chiffres et tirets (3 à 40 caractères). */
export function slugify(value: string): string {
  const base = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base.slice(0, 40).replace(/-$/, '');
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(value);
}

/** Lien à partager sur WhatsApp (origine du navigateur, sinon chemin relatif). */
export function publicShopUrl(slug: string, origin?: string): string {
  const base = origin ?? (typeof window === 'undefined' ? '' : window.location.origin);
  return `${base}/b/${slug}`;
}

/** Lien WhatsApp « wa.me » : le commerçant peut aussi envoyer le sien pour rassurer. */
export function whatsappShareUrl(text: string, phone?: string | null): string {
  const digits = (phone ?? '').replace(/[^0-9]/g, '');
  return digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function getShopInfo(slug: string): Promise<ShopInfo | null> {
  const payload = await apiFetch<unknown>(`/shop/${slug}`, '');
  return payload === null ? null : shopInfoSchema.parse(payload);
}

export async function getShopCatalog(slug: string): Promise<ShopItem[]> {
  return z.array(shopItemSchema).parse(await apiFetch<unknown>(`/shop/${slug}/catalog`, ''));
}

export async function placeShopOrder(
  slug: string,
  input: ShopOrderInput,
  idempotencyKey: string,
): Promise<ShopOrderReceipt> {
  return shopOrderReceiptSchema.parse(
    await apiFetch<unknown>(`/shop/${slug}/orders`, '', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(input),
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Côté commerçant : réglages de la boutique et commandes reçues.      */
/* ------------------------------------------------------------------ */

const settingsSchema = z.object({
  tenant_id: z.uuid(),
  slug: z.string(),
  display_name: z.string(),
  whatsapp: z.string().nullable(),
  published: z.boolean(),
  default_location_id: z.uuid().nullable(),
  public_path: z.string().nullable(),
  currency_code: z.string(),
});

const orderItemSchema = z.object({
  variant_id: z.uuid(),
  product_name: z.string(),
  sku: z.string(),
  unit_price: z.number(),
  quantity: z.number(),
  line_total: z.number(),
});

const orderSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'delivered']),
  customer_name: z.string(),
  customer_phone: z.string(),
  note: z.string().nullable(),
  subtotal: z.number(),
  total: z.number(),
  item_count: z.number(),
  sale_id: z.uuid().nullable(),
  cancel_reason: z.string().nullable(),
  created_at: z.string(),
  confirmed_at: z.string().nullable(),
  delivered_at: z.string().nullable(),
  cancelled_at: z.string().nullable(),
  items: z.array(orderItemSchema),
});

export type StorefrontSettings = z.infer<typeof settingsSchema>;
export type StorefrontOrder = z.infer<typeof orderSchema>;
export type StorefrontOrderItem = z.infer<typeof orderItemSchema>;

export interface StorefrontSettingsInput {
  slug: string;
  display_name: string | null;
  whatsapp: string | null;
  published: boolean;
  default_location_id: string | null;
}

const base = (tenantId: string) => `/tenants/${tenantId}/storefront`;

export async function getStorefrontSettings(token: string, tenantId: string): Promise<StorefrontSettings> {
  return settingsSchema.parse(await apiFetch<unknown>(base(tenantId), token));
}

export async function saveStorefrontSettings(
  token: string,
  tenantId: string,
  input: StorefrontSettingsInput,
): Promise<StorefrontSettings> {
  return settingsSchema.parse(
    await apiFetch<unknown>(base(tenantId), token, { method: 'POST', body: JSON.stringify(input) }),
  );
}

export async function listStorefrontOrders(token: string, tenantId: string): Promise<StorefrontOrder[]> {
  return z.array(orderSchema).parse(await apiFetch<unknown>(`${base(tenantId)}/orders`, token));
}

export async function confirmStorefrontOrder(
  token: string,
  tenantId: string,
  orderId: string,
  locationId: string | null,
): Promise<void> {
  await apiFetch(`${base(tenantId)}/orders/${orderId}/confirm`, token, {
    method: 'POST',
    body: JSON.stringify({ location_id: locationId }),
  });
}

export async function cancelStorefrontOrder(
  token: string,
  tenantId: string,
  orderId: string,
  reason: string,
): Promise<void> {
  await apiFetch(`${base(tenantId)}/orders/${orderId}/cancel`, token, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function markStorefrontOrderDelivered(
  token: string,
  tenantId: string,
  orderId: string,
): Promise<void> {
  await apiFetch(`${base(tenantId)}/orders/${orderId}/delivered`, token, { method: 'POST', body: '{}' });
}

export const orderStatusLabels = {
  pending: 'À confirmer',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
  delivered: 'Livrée',
} as const;

export const orderStatusTones = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  confirmed: 'bg-teal-50 text-mint-dark border-teal-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
} as const;

/** Message prêt à coller dans un statut WhatsApp. */
export function shopShareMessage(shop: { display_name: string; slug: string }): string {
  return `Bonjour ! Voici ma boutique ${shop.display_name} : ${publicShopUrl(shop.slug)}`;
}

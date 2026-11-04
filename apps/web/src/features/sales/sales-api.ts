import { z } from 'zod';
import { apiFetch } from '../onboarding/tenant-api';

export const paymentMethods = ['cash', 'mobile_money', 'credit'] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  credit: 'Crédit (à crédit)',
};

const saleSummarySchema = z.object({
  id: z.uuid(),
  tenant_id: z.uuid(),
  number: z.string(),
  status: z.enum(['completed', 'voided']),
  location_id: z.uuid(),
  location_name: z.string(),
  payment_method: z.enum(paymentMethods),
  payment_reference: z.string().nullable(),
  customer_name: z.string().nullable(),
  note: z.string().nullable(),
  subtotal: z.number(),
  total: z.number(),
  total_cost: z.number(),
  margin: z.number(),
  item_count: z.number(),
  created_at: z.string(),
  voided_at: z.string().nullable(),
});

const saleItemSchema = z.object({
  id: z.uuid(),
  sale_id: z.uuid(),
  variant_id: z.uuid(),
  product_name: z.string(),
  sku: z.string(),
  unit_price: z.number(),
  unit_cost: z.number(),
  quantity: z.number(),
  line_total: z.number(),
});

const saleDetailSchema = saleSummarySchema.extend({ items: z.array(saleItemSchema) });

export type SaleSummary = z.infer<typeof saleSummarySchema>;
export type SaleItem = z.infer<typeof saleItemSchema>;
export type SaleDetail = z.infer<typeof saleDetailSchema>;

export interface SaleLineInput {
  variant_id: string;
  quantity: number;
  unit_price?: number;
}

export interface SaleInput {
  location_id: string;
  payment_method: PaymentMethod;
  payment_reference: string | null;
  customer_name: string | null;
  note: string | null;
  items: SaleLineInput[];
}

const base = (tenantId: string) => `/tenants/${tenantId}`;

export async function listSales(token: string, tenantId: string) {
  return z.array(saleSummarySchema).parse(await apiFetch(`${base(tenantId)}/sales`, token));
}

export async function getSale(token: string, tenantId: string, saleId: string) {
  return saleDetailSchema.parse(await apiFetch(`${base(tenantId)}/sales/${saleId}`, token));
}

export async function createSale(token: string, tenantId: string, input: SaleInput, key: string) {
  return saleDetailSchema.parse(await apiFetch(`${base(tenantId)}/sales`, token, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(input),
  }));
}

export async function voidSale(token: string, tenantId: string, saleId: string, reason: string, key: string) {
  return saleDetailSchema.parse(await apiFetch(`${base(tenantId)}/sales/${saleId}/void`, token, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ reason }),
  }));
}

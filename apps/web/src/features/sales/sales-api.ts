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

const creditSaleSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  customer_name: z.string().nullable(),
  total: z.number(),
  paid: z.number(),
  remaining: z.number(),
  created_at: z.string(),
});

export type CreditSale = z.infer<typeof creditSaleSchema>;
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

/** Ventes à crédit qui attendent encore un règlement. */
export async function listCreditSales(token: string, tenantId: string): Promise<CreditSale[]> {
  return z.array(creditSaleSchema).parse(await apiFetch(`${base(tenantId)}/credits`, token));
}

/** Encaisse le reste dû sur une vente à crédit. */
export async function addCreditPayment(
  token: string,
  tenantId: string,
  saleId: string,
  input: { amount: number; method: 'cash' | 'mobile_money'; reference: string | null },
): Promise<{ sale_id: string; paid: number; remaining: number }> {
  return z
    .object({ sale_id: z.uuid(), paid: z.number(), remaining: z.number() })
    .parse(
      await apiFetch(`${base(tenantId)}/credits/${saleId}/payments`, token, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
}

export async function voidSale(token: string, tenantId: string, saleId: string, reason: string, key: string) {
  return saleDetailSchema.parse(await apiFetch(`${base(tenantId)}/sales/${saleId}/void`, token, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ reason }),
  }));
}

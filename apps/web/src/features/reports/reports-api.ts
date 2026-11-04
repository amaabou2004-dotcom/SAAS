import { z } from 'zod';
import { apiFetch } from '../onboarding/tenant-api';

const totalsSchema = z.object({
  sales: z.number(),
  revenue: z.number(),
  cost: z.number(),
  margin: z.number(),
  items: z.number(),
  average_basket: z.number(),
});

const todaySchema = z.object({
  sales: z.number(),
  revenue: z.number(),
  margin: z.number(),
});

const dailySchema = z.object({
  day: z.string(),
  sales: z.number(),
  revenue: z.number(),
  margin: z.number(),
});

const productPerformanceSchema = z.object({
  variant_id: z.uuid(),
  product_name: z.string(),
  sku: z.string(),
  quantity: z.number(),
  revenue: z.number(),
  margin: z.number(),
});

const categoryPerformanceSchema = z.object({
  category_id: z.uuid().nullable(),
  category_name: z.string(),
  quantity: z.number(),
  revenue: z.number(),
  margin: z.number(),
});

const dormantSchema = z.object({
  variant_id: z.uuid(),
  product_name: z.string(),
  sku: z.string(),
  on_hand: z.number(),
  stock_value: z.number(),
  last_sold_at: z.string().nullable(),
});

const reportSchema = z.object({
  from: z.string(),
  to: z.string(),
  timezone: z.string(),
  totals: totalsSchema,
  today: todaySchema,
  daily: z.array(dailySchema),
  top_products: z.array(productPerformanceSchema),
  top_categories: z.array(categoryPerformanceSchema),
  dormant: z.array(dormantSchema),
  stock_value: z.number(),
  product_count: z.number(),
});

export type ReportTotals = z.infer<typeof totalsSchema>;
export type ReportDaily = z.infer<typeof dailySchema>;
export type ProductPerformance = z.infer<typeof productPerformanceSchema>;
export type CategoryPerformance = z.infer<typeof categoryPerformanceSchema>;
export type DormantProduct = z.infer<typeof dormantSchema>;
export type Report = z.infer<typeof reportSchema>;

/** Date du jour (AAAA-MM-JJ) dans le fuseau de l'entreprise. */
export function todayInTimezone(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Période glissante de `days` jours, bornes incluses, dans le fuseau de l'entreprise. */
export function periodRange(days: number, timezone: string, now: Date = new Date()) {
  const to = new Date(`${todayInTimezone(timezone, now)}T00:00:00Z`);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export async function getReport(token: string, tenantId: string, from: string, to: string) {
  const query = new URLSearchParams({ from, to }).toString();
  return reportSchema.parse(await apiFetch(`/tenants/${tenantId}/reports?${query}`, token));
}

const csvCell = (value: string | number | null) => {
  const text = value === null ? '' : String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Export CSV (séparateur `;`, conforme aux tableurs francophones). */
export function buildReportCsv(report: Report): string {
  const lines: string[] = [];
  lines.push(`Rapport;du ${report.from};au ${report.to};fuseau ${report.timezone}`);
  lines.push('');
  lines.push('Jour;Ventes;Chiffre d’affaires;Marge');
  for (const day of report.daily) {
    lines.push([day.day, day.sales, day.revenue, day.margin].map(csvCell).join(';'));
  }
  lines.push('');
  lines.push('Produit;SKU;Quantité vendue;Chiffre d’affaires;Marge');
  for (const product of report.top_products) {
    lines.push(
      [product.product_name, product.sku, product.quantity, product.revenue, product.margin]
        .map(csvCell)
        .join(';'),
    );
  }
  lines.push('');
  lines.push('Catégorie;Quantité vendue;Chiffre d’affaires;Marge');
  for (const category of report.top_categories) {
    lines.push([category.category_name, category.quantity, category.revenue, category.margin].map(csvCell).join(';'));
  }
  lines.push('');
  lines.push('Produit dormant;SKU;Stock;Valeur immobilisée;Dernière vente');
  for (const product of report.dormant) {
    lines.push(
      [product.product_name, product.sku, product.on_hand, product.stock_value, product.last_sold_at]
        .map(csvCell)
        .join(';'),
    );
  }
  return `${lines.join('\n')}\n`;
}

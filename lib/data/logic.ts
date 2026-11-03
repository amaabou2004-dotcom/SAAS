/**
 * Logique métier pure du stock : statuts, valorisation, couverture, tri.
 * Aucune I/O — testé dans tests/stock.test.ts
 */

import type { Product, StockRow } from "./types";

export interface RowInput {
  product: Product;
  on_hand: number;
  reserved: number;
  issues_60d: number;
  receipts_60d: number;
  category_name: string;
  supplier_name: string | null;
  location_name: string;
}

/** Seuil « stock bas » : 1,5× le point de commande, ou rupture imminente. */
export function stockStatus(onHand: number, reorderPoint: number): StockRow["status"] {
  if (onHand <= 0) return "out";
  if (onHand <= reorderPoint) return "low";
  return "ok";
}

/** Consommation quotidienne moyenne (60 jours glissants). */
export function dailyDemand(issues60d: number): number {
  return issues60d / 60;
}

/**
 * Couverture en jours de la demande, ou `null` si le produit ne bouge pas
 * (division par zéro → ne pas afficher d'infini dans l'UI).
 */
export function coverDays(available: number, issues60d: number): number | null {
  const daily = dailyDemand(issues60d);
  if (daily <= 0) return null;
  return Math.round(available / daily);
}

/** Quantité à commander pour repasser au-dessus du point de commande. */
export function suggestedOrder(onHand: number, reorderPoint: number, reorderQty: number): number {
  if (onHand > reorderPoint) return 0;
  const missing = reorderPoint - onHand;
  return Math.max(reorderQty, Math.ceil(missing));
}

/** Jours avant rupture, ou `null` si le produit ne se vend pas. */
export function daysToStockout(available: number, issues60d: number): number | null {
  const daily = dailyDemand(issues60d);
  if (daily <= 0) return null;
  return Math.max(0, Math.floor(available / daily));
}

export function buildRow(input: RowInput): StockRow {
  const available = input.on_hand - input.reserved;
  const daily = dailyDemand(input.issues_60d);
  return {
    ...input.product,
    on_hand: input.on_hand,
    reserved: input.reserved,
    available,
    issues_60d: input.issues_60d,
    receipts_60d: input.receipts_60d,
    category_name: input.category_name,
    supplier_name: input.supplier_name,
    location_name: input.location_name,
    status: stockStatus(available, input.product.reorder_point),
    stock_value_cost: Math.round(input.on_hand * input.product.cost_price),
    stock_value_sale: Math.round(input.on_hand * input.product.sale_price),
    cover_days: coverDays(available, input.issues_60d),
  };
}

/**
 * Tri « à traiter d'abord » : ruptures, puis stock bas par couverture
 * croissante, puis les stocks OK par couverture croissante (un produit qui
 * tourne vite reste prioritaire même au-dessus du seuil), puis par nom.
 */
export function sortByUrgency(rows: StockRow[]): StockRow[] {
  const rank = { out: 0, low: 1, ok: 2 } as const;
  return [...rows].sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    const ca = a.cover_days ?? Number.POSITIVE_INFINITY;
    const cb = b.cover_days ?? Number.POSITIVE_INFINITY;
    if (ca !== cb) return ca - cb;
    return a.name.localeCompare(b.name, "fr");
  });
}

export interface StockKpis {
  skus: number;
  out: number;
  low: number;
  ok: number;
  value_cost: number;
  value_sale: number;
  potential_margin: number;
  issues_60d: number;
  receipts_60d: number;
  to_reorder: number;
  reorder_cost: number;
}

export function computeKpis(rows: StockRow[]): StockKpis {
  const kpis: StockKpis = {
    skus: rows.length,
    out: 0,
    low: 0,
    ok: 0,
    value_cost: 0,
    value_sale: 0,
    potential_margin: 0,
    issues_60d: 0,
    receipts_60d: 0,
    to_reorder: 0,
    reorder_cost: 0,
  };
  for (const row of rows) {
    kpis[row.status] += 1;
    kpis.value_cost += row.stock_value_cost;
    kpis.value_sale += row.stock_value_sale;
    kpis.issues_60d += row.issues_60d;
    kpis.receipts_60d += row.receipts_60d;
    const qty = suggestedOrder(row.available, row.reorder_point, row.reorder_qty);
    if (qty > 0) {
      kpis.to_reorder += 1;
      kpis.reorder_cost += qty * row.cost_price;
    }
  }
  kpis.potential_margin = kpis.value_sale - kpis.value_cost;
  return kpis;
}

/** Rotation annuelle estimée à partir de 60 jours de sorties. */
export function turnover(issues60d: number, onHand: number): number | null {
  if (onHand <= 0) return null;
  const annualIssues = (issues60d / 60) * 365;
  return Math.round((annualIssues / onHand) * 10) / 10;
}

export const OP_LABELS: Record<string, string> = {
  opening: "Stock initial",
  receipt: "Réception",
  issue: "Sortie",
  adjustment: "Ajustement",
  inventory: "Inventaire",
  transfer: "Transfert",
  reversal: "Annulation",
};

export function formatQty(value: number, unit: string): string {
  const rounded = Math.round(value * 100) / 100;
  const text = rounded.toLocaleString("fr-FR");
  return `${text} ${unit}`;
}

export function relativeDays(iso: string, today = new Date().toISOString().slice(0, 10)): number {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/**
 * Cœur métier pur (aucune I/O) : monnaie, TVA, échéances.
 * Testé unitairement dans tests/money.test.ts
 */

export const FCFA = "XOF";

/** Taux de TVA appliqués (Niger : 19 %). */
export const VAT_RATES: Record<string, number> = {
  NE: 0.19,
  SN: 0.18,
  CI: 0.18,
  ML: 0.18,
  BF: 0.18,
  TG: 0.18,
  BJ: 0.18,
  FR: 0.2,
};

/** Arrondit à l'entier le plus proche (le FCFA n'a pas de centimes). */
export function roundXof(value: number): number {
  return Math.round(value);
}

/** 1234567 -> "1 234 567 FCFA" (espace insécable fine, convention UEMOA). */
export function formatXof(value: number): string {
  const rounded = roundXof(value);
  const sign = rounded < 0 ? "-" : "";
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
  return `${sign}${digits}\u00A0FCFA`;
}

export function formatMoney(value: number, currency: string): string {
  if (currency === FCFA) return formatXof(value);
  const rounded = Math.round(value * 100) / 100;
  const [int, dec = "00"] = rounded.toFixed(2).split(".");
  const digits = int.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
  return `${digits},${dec}\u00A0${currency}`;
}

/** Conversion avec arrondi FCFA quand la cible est le XOF. */
export function convert(amount: number, rate: number, to: string): number {
  const raw = amount * rate;
  return to === FCFA ? roundXof(raw) : Math.round(raw * 100) / 100;
}

export interface InvoiceInput {
  amount: number;
  currency: string;
  rateToXof: number;
  vatRate: number;
  dueInDays: number;
  issueDate: string; // YYYY-MM-DD
}

export interface InvoiceTotals {
  htXof: number;
  vatXof: number;
  ttcXof: number;
  htSource: number;
  currency: string;
}

export function computeInvoice(input: InvoiceInput): InvoiceTotals {
  const htSource = input.amount;
  const htXof = convert(htSource, input.rateToXof, FCFA);
  const vatXof = roundXof(htXof * input.vatRate);
  return {
    htSource,
    currency: input.currency,
    htXof,
    vatXof,
    ttcXof: htXof + vatXof,
  };
}

/** Ajoute des jours à une date ISO (UTC, sans dérive de fuseau). */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Décale l'échéance au prochain jour ouvré : ni samedi, ni dimanche, ni jour
 * férié. `holidays` contient des dates ISO (YYYY-MM-DD).
 */
export function nextBusinessDay(iso: string, holidays: string[]): string {
  const set = new Set(holidays);
  let current = iso;
  for (let i = 0; i < 30; i += 1) {
    const day = new Date(`${current}T00:00:00Z`).getUTCDay(); // 0 = dimanche, 6 = samedi
    const weekend = day === 0 || day === 6;
    if (!weekend && !set.has(current)) return current;
    current = addDays(current, 1);
  }
  return current;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

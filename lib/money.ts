/** Formatage monétaire FCFA / autres devises (aucune I/O). */

export const FCFA = "XOF";

export function roundXof(value: number): number {
  return Math.round(value);
}

/** 1234567 -> "1 234 567 FCFA" (espace fine insécable, convention UEMOA). */
export function formatXof(value: number): string {
  const rounded = roundXof(value);
  const sign = rounded < 0 ? "-" : "";
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
  return `${sign}${digits}\u00A0FCFA`;
}

export function formatMoney(value: number, currency = FCFA): string {
  if (currency === FCFA) return formatXof(value);
  const rounded = Math.round(value * 100) / 100;
  const [int, dec = "00"] = rounded.toFixed(2).split(".");
  const digits = int.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
  return `${digits},${dec}\u00A0${currency}`;
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000,
  );
}

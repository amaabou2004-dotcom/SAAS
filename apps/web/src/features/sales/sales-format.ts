/**
 * Repères de date et de montant propres aux ventes.
 * L'argent reste en FCFA (XOF) : pas de centimes affichés, mais deux décimales
 * maximum si une entreprise utilise une autre devise.
 */

export function saleDayKey(isoDate: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(isoDate));
}

export function formatSaleDay(isoDate: string, timezone: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeZone: timezone,
  }).format(new Date(isoDate));
}

export function formatSaleTime(isoDate: string, timezone: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(isoDate));
}

export function sumBy<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}

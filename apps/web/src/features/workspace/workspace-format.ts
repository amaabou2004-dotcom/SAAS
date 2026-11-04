export const quantityFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 });

export function formatQuantity(value: number) {
  return quantityFormat.format(value);
}

export function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value));
}

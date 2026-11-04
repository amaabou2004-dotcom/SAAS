import { formatMoney, formatQuantity } from '../workspace/workspace-format';
import { paymentMethodLabels, type SaleDetail } from './sales-api';
import { formatSaleDay, formatSaleTime } from './sales-format';

/**
 * Reçu envoyé au client sur WhatsApp : texte simple, lisible sur tous les
 * téléphones, sans lien ni pièce jointe.
 */
export function receiptWhatsAppText(
  sale: SaleDetail,
  options: { shopName: string; currency: string; timezone: string },
): string {
  const { shopName, currency, timezone } = options;
  const lines = sale.items.map(
    (item) => `• ${formatQuantity(item.quantity)} × ${item.product_name} — ${formatMoney(item.line_total, currency)}`,
  );

  return [
    `Reçu ${sale.number}`,
    shopName,
    `${formatSaleDay(sale.created_at, timezone)} à ${formatSaleTime(sale.created_at, timezone)}`,
    '',
    ...lines,
    '',
    `Total : ${formatMoney(sale.total, currency)}`,
    `Paiement : ${paymentMethodLabels[sale.payment_method]}`,
    '',
    'Merci pour votre confiance !',
  ].join('\n');
}

/** Lien WhatsApp : avec le numéro du client s'il est connu, sinon choix du contact. */
export function receiptWhatsAppUrl(text: string, phone?: string | null): string {
  const digits = (phone ?? '').replace(/[^0-9]/g, '');
  const encoded = encodeURIComponent(text);
  return digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

import { Receipt } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatMoney, formatQuantity } from '../workspace/workspace-format';
import { paymentMethodLabels, type SaleDetail } from './sales-api';
import { formatSaleDay, formatSaleTime } from './sales-format';

interface SaleTicketProps {
  sale: SaleDetail;
  currency: string;
  timezone: string;
  footer?: ReactNode;
}

/**
 * Ticket de caisse lisible sur téléphone comme sur écran large.
 * `data-print="ticket"` permet à la feuille d'impression de n'imprimer que lui.
 */
export function SaleTicket({ sale, currency, timezone, footer }: SaleTicketProps) {
  const voided = sale.status === 'voided';

  return (
    <article
      data-print="ticket"
      className="rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-label={`Ticket ${sale.number}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Receipt className="size-4" aria-hidden="true" />
            {voided ? 'Vente annulée' : 'Ticket de vente'}
          </p>
          <h2 className="mt-1 font-mono text-xl font-bold text-ink">{sale.number}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {formatSaleDay(sale.created_at, timezone)} à {formatSaleTime(sale.created_at, timezone)} · {sale.location_name}
          </p>
          {sale.customer_name ? <p className="mt-1 text-sm text-slate-600">Client : {sale.customer_name}</p> : null}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${voided ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
        >
          {voided ? 'Annulée' : 'Encaissée'}
        </span>
      </header>

      <div className="overflow-x-auto px-5 sm:px-6">
        <table className="w-full min-w-[380px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-3">Produit</th>
              <th className="py-3 text-right">Qté</th>
              <th className="py-3 text-right">Prix</th>
              <th className="py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100 align-top">
                <td className="py-3 pr-3">
                  <strong className="block font-semibold text-ink">{item.product_name}</strong>
                  <span className="mt-0.5 block font-mono text-xs text-slate-500">{item.sku}</span>
                </td>
                <td className="py-3 text-right tabular-nums">{formatQuantity(item.quantity)}</td>
                <td className="py-3 text-right tabular-nums">{formatMoney(item.unit_price, currency)}</td>
                <td className="py-3 text-right font-semibold tabular-nums text-ink">
                  {formatMoney(item.line_total, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 space-y-2 border-t border-slate-100 p-5 text-sm sm:p-6">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-semibold text-ink">Total à payer</span>
          <span className="text-xl font-bold tabular-nums text-ink">{formatMoney(sale.total, currency)}</span>
        </div>
        <div className="flex justify-between gap-4 text-slate-600">
          <span>Paiement</span>
          <span className="text-right">
            {paymentMethodLabels[sale.payment_method]}
            {sale.payment_reference ? ` · ${sale.payment_reference}` : ''}
          </span>
        </div>
        {sale.note ? (
          <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">Note : {sale.note}</p>
        ) : null}
        {voided && sale.voided_at ? (
          <p className="rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-800">
            Annulée le {formatSaleDay(sale.voided_at, timezone)} à {formatSaleTime(sale.voided_at, timezone)}. Le stock a été
            remis en place.
          </p>
        ) : null}
        {footer}
      </div>
    </article>
  );
}

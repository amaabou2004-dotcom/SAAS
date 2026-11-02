import Link from "next/link";
import { listInvoices } from "@/lib/store";
import { formatXof } from "@/lib/money";
import { CtaLink, EmptyState, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function InvoicesPage() {
  const invoices = listInvoices();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Factures</h1>
          <p className="sub">{invoices.length} facture(s) · montants consolidés en FCFA</p>
        </div>
        <CtaLink href="/invoices/new">+ Nouvelle facture</CtaLink>
      </div>

      {invoices.length === 0 ? (
        <EmptyState title="Aucune facture" hint="Crée ta première facture pour voir le suivi." />
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th style={{ paddingTop: 16 }}>N°</th>
                <th style={{ paddingTop: 16 }}>Client</th>
                <th style={{ paddingTop: 16 }}>Échéance</th>
                <th style={{ paddingTop: 16 }}>Statut</th>
                <th className="num" style={{ paddingTop: 16 }}>HT</th>
                <th className="num" style={{ paddingTop: 16 }}>TVA</th>
                <th className="num" style={{ paddingTop: 16 }}>TTC</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <Link href={`/invoices/${invoice.id}`} style={{ fontWeight: 550 }}>
                      {invoice.number}
                    </Link>
                  </td>
                  <td>
                    <div>{invoice.client}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {invoice.country} · {invoice.currency}
                      {invoice.currency !== "XOF"
                        ? ` @ ${invoice.rateToXof.toLocaleString("fr-FR")}`
                        : ""}
                    </div>
                  </td>
                  <td>
                    <div className="mono">{invoice.dueDate}</div>
                    {invoice.dueShiftReason ? (
                      <div className="muted" style={{ fontSize: 12 }}>{invoice.dueShiftReason}</div>
                    ) : null}
                  </td>
                  <td><StatusBadge status={invoice.status} /></td>
                  <td className="num">{formatXof(invoice.htXof)}</td>
                  <td className="num muted">{formatXof(invoice.vatXof)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{formatXof(invoice.ttcXof)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { listInvoices } from "@/lib/store";
import { formatMoney, formatXof } from "@/lib/money";
import { SourceBadge, StatusBadge } from "@/components/ui";
import { StatusActions } from "./StatusActions";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = listInvoices().find((i) => i.id === id);
  if (!invoice) notFound();

  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/invoices" className="muted" style={{ fontSize: 13 }}>
            ← Factures
          </Link>
          <h1 style={{ marginTop: 8 }}>{invoice.number}</h1>
          <p className="sub">
            {invoice.client} · {invoice.country} · émise le {invoice.issueDate}{" "}
            <StatusBadge status={invoice.status} />
          </p>
        </div>
        <StatusActions id={invoice.id} status={invoice.status} />
      </div>

      <div className="grid k2">
        <div className="card">
          <h2>Montants</h2>
          <ul className="list-clean">
            <li>
              <span className="muted">Montant saisi</span>
              <span className="mono">{formatMoney(invoice.amount, invoice.currency)}</span>
            </li>
            <li>
              <span className="muted">Taux de conversion</span>
              <span className="mono">
                {invoice.rateToXof.toLocaleString("fr-FR")} XOF / {invoice.currency}{" "}
                <SourceBadge source={invoice.source} />
              </span>
            </li>
            <li>
              <span className="muted">Total HT (FCFA)</span>
              <span className="mono">{formatXof(invoice.htXof)}</span>
            </li>
            <li>
              <span className="muted">TVA</span>
              <span className="mono">{formatXof(invoice.vatXof)}</span>
            </li>
            <li>
              <span style={{ fontWeight: 600 }}>Total TTC</span>
              <span className="mono" style={{ fontWeight: 700, color: "var(--accent)" }}>
                {formatXof(invoice.ttcXof)}
              </span>
            </li>
          </ul>
        </div>

        <div className="card">
          <h2>Échéance</h2>
          <ul className="list-clean">
            <li>
              <span className="muted">Échéance théorique</span>
              <span className="mono">{invoice.nominalDueDate}</span>
            </li>
            <li>
              <span className="muted">Échéance retenue</span>
              <span className="mono">{invoice.dueDate}</span>
            </li>
            <li>
              <span className="muted">Ajustement</span>
              <span className="mono">{invoice.dueShiftReason ?? "aucun"}</span>
            </li>
            <li>
              <span className="muted">Créée le</span>
              <span className="mono">{invoice.createdAt.slice(0, 10)}</span>
            </li>
          </ul>
          <p className="muted" style={{ fontSize: 12, marginTop: 14, marginBottom: 0 }}>
            L&apos;échéance est décalée si elle tombe un dimanche ou un jour férié du pays du
            client (source : Nager.Date).
          </p>
        </div>
      </div>
    </>
  );
}

import Link from "next/link";
import { getAppContext } from "@/lib/data/server-source";
import { computeKpis, OP_LABELS, suggestedOrder } from "@/lib/data/logic";
import { formatMoney, formatXof } from "@/lib/money";
import { FlowBars, Kpi, LinkButton, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { source } = await getAppContext();
  const [rows, operations, weekly, tenant] = await Promise.all([
    source.getRows(),
    source.getOperations(6),
    source.getWeekly(),
    source.getTenant(),
  ]);

  const kpis = computeKpis(rows);
  const last = weekly[weekly.length - 1];
  const prior = weekly[weekly.length - 2];
  const inTrend = prior && last ? last.receipts - prior.receipts : 0;
  const outTrend = prior && last ? last.issues - prior.issues : 0;
  const alerts = rows.filter((r) => r.status !== "ok").slice(0, 6);
  const reorder = rows
    .filter((r) => suggestedOrder(r.available, r.reorder_point, r.reorder_qty) > 0)
    .sort((a, b) => (a.cover_days ?? 999) - (b.cover_days ?? 999))
    .slice(0, 5);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tableau de bord</h1>
          <p className="sub">
            {tenant.name} · {tenant.address} · {kpis.skus} références · devise {tenant.currency_code}
          </p>
        </div>
        <div className="row">
          <LinkButton href="/operations">Nouvelle opération</LinkButton>
          <LinkButton href="/stock" primary>
            Voir le stock
          </LinkButton>
        </div>
      </div>

      <div className="grid c4" style={{ marginBottom: 12 }}>
        <Kpi
          label="Valeur du stock (coût)"
          value={formatXof(kpis.value_cost)}
          hint={`${formatXof(kpis.value_sale)} au prix de vente`}
        />
        <Kpi
          label="Ruptures"
          value={String(kpis.out)}
          tone={kpis.out > 0 ? "bad" : "good"}
          hint={`${kpis.low} référence(s) sous le point de commande`}
        />
        <Kpi
          label="À réapprovisionner"
          value={String(kpis.to_reorder)}
          tone={kpis.to_reorder > 0 ? "warn" : "good"}
          hint={`${formatXof(kpis.reorder_cost)} d’achat estimé`}
        />
        <Kpi
          label="Sorties 60 jours"
          value={String(kpis.issues_60d)}
          hint={`${kpis.receipts_60d} entrées · marge potentielle ${formatXof(kpis.potential_margin)}`}
        />
      </div>

      <div className="grid c2" style={{ marginBottom: 12, alignItems: "start" }}>
        <section className="card">
          <div className="card-head">
            <h2>À traiter en priorité</h2>
            <span className="spacer" />
            <Link href="/stock" className="small muted">Tout voir →</Link>
          </div>
          {alerts.length === 0 ? (
            <div className="empty">Aucune alerte : tous les stocks sont au-dessus du seuil.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>État</th>
                  <th className="num">Dispo.</th>
                  <th className="num hide-sm">Couverture</th>
                  <th className="num">À commander</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((row) => (
                  <tr key={row.variant_id}>
                    <td>
                      <div style={{ fontWeight: 550 }}>{row.name}</div>
                      <div className="muted small mono">{row.sku} · {row.unit}</div>
                    </td>
                    <td><StatusPill status={row.status} /></td>
                    <td className="num">{row.available}</td>
                    <td className="num hide-sm">
                      {row.cover_days === null ? <span className="muted">—</span> : `${row.cover_days} j`}
                    </td>
                    <td className="num">
                      {suggestedOrder(row.available, row.reorder_point, row.reorder_qty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Flux hebdomadaires</h2>
            <span className="spacer" />
            <span className="tag">8 semaines</span>
          </div>
          <FlowBars data={weekly} />
          <p className="muted small" style={{ marginTop: 10, marginBottom: 0 }}>
            {prior && last ? (
              <>
                Semaine du {last.week} : {last.issues} sorties ({outTrend >= 0 ? "+" : ""}
                {outTrend} vs semaine précédente) et {last.receipts} entrées ({inTrend >= 0 ? "+" : ""}
                {inTrend}).{" "}
                {last.operations < 20 ? "Semaine en cours, donc partielle. " : null}
                {last.receipts < last.issues
                  ? `Le stock se vide : ${last.issues - last.receipts} unités de plus sont sorties que rentrées.`
                  : `Le réassort couvre les sorties (${last.receipts - last.issues} unités d’avance).`}
              </>
            ) : (
              "Pas encore assez d’historique pour comparer les semaines."
            )}
          </p>
        </section>
      </div>

      <div className="grid c2" style={{ alignItems: "start" }}>
        <section className="card">
          <div className="card-head">
            <h2>Réapprovisionnement suggéré</h2>
            <span className="spacer" />
            <Link href="/fournisseurs" className="small muted">Fournisseurs →</Link>
          </div>
          {reorder.length === 0 ? (
            <div className="empty">Rien à commander.</div>
          ) : (
            <ul className="list-clean">
              {reorder.map((row) => {
                const qty = suggestedOrder(row.available, row.reorder_point, row.reorder_qty);
                return (
                  <li key={row.variant_id}>
                    <span>
                      <strong>{row.name}</strong>
                      <br />
                      <span className="muted small">
                        {row.supplier_name ?? "Sans fournisseur"} · seuil {row.reorder_point} {row.unit}
                      </span>
                    </span>
                    <span className="right">
                      <span className="mono">{qty} {row.unit}</span>
                      <br />
                      <span className="muted small">{formatMoney(qty * row.cost_price, tenant.currency_code)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Dernières opérations</h2>
            <span className="spacer" />
            <Link href="/operations" className="small muted">Journal →</Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Référence</th>
                <th className="num">Lignes</th>
                <th className="num hide-sm">Date</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((op) => (
                <tr key={op.id}>
                  <td>
                    <span className={`pill ${op.operation_type === "receipt" ? "info" : op.operation_type === "issue" ? "ok" : "neutral"}`}>
                      {OP_LABELS[op.operation_type] ?? op.operation_type}
                    </span>
                  </td>
                  <td>
                    <div className="mono">{op.reference ?? "—"}</div>
                    <div className="muted small">{op.reason ?? ""}</div>
                  </td>
                  <td className="num">{op.lines.length}</td>
                  <td className="num hide-sm muted">{op.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}

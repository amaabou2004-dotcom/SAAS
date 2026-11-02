import { getAppContext } from "@/lib/data/server-source";
import { OP_LABELS } from "@/lib/data/logic";
import { OperationForm } from "./OperationForm";

export const dynamic = "force-dynamic";

const PILL: Record<string, string> = {
  receipt: "info",
  issue: "ok",
  opening: "neutral",
  adjustment: "low",
  inventory: "low",
  reversal: "out",
};

export default async function OperationsPage() {
  const { source } = await getAppContext();
  const [rows, operations] = await Promise.all([source.getRows(), source.getOperations(40)]);

  const options = rows.map((row) => ({
    variant_id: row.variant_id,
    name: row.name,
    sku: row.sku,
    unit: row.unit,
    available: row.available,
    status: row.status,
  }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Opérations de stock</h1>
          <p className="sub">
            Chaque mouvement est journalisé et rattaché à une opération : rien ne se modifie sans trace.
          </p>
        </div>
      </div>

      <div className="grid c2" style={{ alignItems: "start", marginBottom: 14 }}>
        <OperationForm options={options} />
        <section className="card">
          <h2>Règles appliquées par la base</h2>
          <ul className="list-clean">
            <li>
              <span className="muted">Réception / stock initial</span>
              <span>quantités strictement positives</span>
            </li>
            <li>
              <span className="muted">Sortie</span>
              <span>quantités négatives, stock disponible vérifié</span>
            </li>
            <li>
              <span className="muted">Ajustement / inventaire</span>
              <span>motif obligatoire (2 à 500 caractères)</span>
            </li>
            <li>
              <span className="muted">Idempotence</span>
              <span>une clé = une opération, jamais de doublon réseau</span>
            </li>
            <li>
              <span className="muted">Concurrence</span>
              <span>soldes verrouillés ligne par ligne (FOR UPDATE)</span>
            </li>
            <li>
              <span className="muted">Permissions</span>
              <span>inventory.manage requis, vérifié côté serveur</span>
            </li>
          </ul>
          <p className="muted small" style={{ marginTop: 10, marginBottom: 0 }}>
            En mode démo, ces contrôles sont rejoués dans <code>lib/data/repository.ts</code> avec le
            même contrat d’erreur que le RPC <code>post_stock_operation</code>.
          </p>
        </section>
      </div>

      <div className="card tight">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Référence</th>
              <th>Motif</th>
              <th>Lignes</th>
              <th className="hide-sm">Par</th>
              <th className="num">Date</th>
            </tr>
          </thead>
          <tbody>
            {operations.map((op) => (
              <tr key={op.id}>
                <td>
                  <span className={`pill ${PILL[op.operation_type] ?? "neutral"}`}>
                    {OP_LABELS[op.operation_type] ?? op.operation_type}
                  </span>
                  {op.status === "reversed" ? <span className="pill out" style={{ marginLeft: 4 }}>annulée</span> : null}
                </td>
                <td className="mono">{op.reference ?? "—"}</td>
                <td className="muted">{op.reason ?? "—"}</td>
                <td>
                  {op.lines.map((line) => (
                    <div key={line.variant_id} className="small">
                      <span className="mono">{line.sku}</span>{" "}
                      <span className={line.quantity_delta > 0 ? "pill ok" : "pill out"}>
                        {line.quantity_delta > 0 ? "+" : ""}
                        {line.quantity_delta}
                      </span>{" "}
                      <span className="muted">→ {line.on_hand_after}</span>
                    </div>
                  ))}
                </td>
                <td className="hide-sm muted small">{op.actor}</td>
                <td className="num muted small">
                  {op.created_at.slice(0, 10)}
                  <br />
                  {op.created_at.slice(11, 16)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

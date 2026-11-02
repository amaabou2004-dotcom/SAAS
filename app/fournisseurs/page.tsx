import { getDataSource } from "@/lib/data/repository";
import { suggestedOrder } from "@/lib/data/logic";
import { formatXof } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const source = getDataSource();
  const [rows, suppliers, tenant] = await Promise.all([
    source.getRows(),
    source.getSuppliers(),
    source.getTenant(),
  ]);

  const bySupplier = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.supplier_id ?? "none";
    const list = bySupplier.get(key) ?? [];
    list.push(row);
    bySupplier.set(key, list);
  }

  const reorderTotal = suppliers.reduce((sum, supplier) => {
    const items = bySupplier.get(supplier.id) ?? [];
    return (
      sum +
      items.reduce(
        (acc, row) =>
          acc + suggestedOrder(row.available, row.reorder_point, row.reorder_qty) * row.cost_price,
        0,
      )
    );
  }, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Fournisseurs</h1>
          <p className="sub">
            {suppliers.length} partenaires · {formatXof(reorderTotal)} de réassort à passer
          </p>
        </div>
      </div>

      <div className="grid c2">
        {suppliers.map((supplier) => {
          const items = bySupplier.get(supplier.id) ?? [];
          const toOrder = items.filter(
            (row) => suggestedOrder(row.available, row.reorder_point, row.reorder_qty) > 0,
          );
          const cost = toOrder.reduce(
            (sum, row) =>
              sum + suggestedOrder(row.available, row.reorder_point, row.reorder_qty) * row.cost_price,
            0,
          );
          const nextDelivery = new Date(Date.now() + supplier.lead_time_days * 86_400_000)
            .toISOString()
            .slice(0, 10);

          return (
            <section className="card" key={supplier.id}>
              <div className="card-head">
                <div>
                  <h2 style={{ marginBottom: 2 }}>{supplier.name}</h2>
                  <div className="muted small">
                    {supplier.contact ?? "—"} · {supplier.city ?? "—"}
                  </div>
                </div>
                <span className="spacer" />
                <span className={`pill ${toOrder.length > 0 ? "low" : "ok"}`}>
                  {toOrder.length} à commander
                </span>
              </div>

              <ul className="list-clean">
                <li>
                  <span className="muted">Téléphone</span>
                  <span>{supplier.phone ?? "—"}</span>
                </li>
                <li>
                  <span className="muted">Email</span>
                  <span className="small">{supplier.email ?? "—"}</span>
                </li>
                <li>
                  <span className="muted">Délai de livraison</span>
                  <span>
                    {supplier.lead_time_days} j <span className="muted small">→ {nextDelivery}</span>
                  </span>
                </li>
                <li>
                  <span className="muted">Références fournies</span>
                  <span>{items.length}</span>
                </li>
                <li>
                  <span className="muted">Valeur du réassort</span>
                  <span className="mono">{formatXof(cost)}</span>
                </li>
              </ul>

              {supplier.notes ? (
                <p className="muted small" style={{ marginTop: 8, marginBottom: 0 }}>
                  « {supplier.notes} »
                </p>
              ) : null}

              {toOrder.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <h3>À commander</h3>
                  {toOrder.slice(0, 5).map((row) => (
                    <div key={row.variant_id} className="row small" style={{ padding: "3px 0" }}>
                      <span>{row.name}</span>
                      <span className="spacer" />
                      <span className="mono">
                        {suggestedOrder(row.available, row.reorder_point, row.reorder_qty)} {row.unit}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted small" style={{ marginTop: 10, marginBottom: 0 }}>
                  Aucun réassort nécessaire (devise {tenant.currency_code}).
                </p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

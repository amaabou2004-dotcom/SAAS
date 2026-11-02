import { getDataSource } from "@/lib/data/repository";
import { formatXof } from "@/lib/money";
import { StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CataloguePage() {
  const source = getDataSource();
  const [rows, suppliers] = await Promise.all([source.getRows(), source.getSuppliers()]);
  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = groups.get(row.category_name) ?? [];
    list.push(row);
    groups.set(row.category_name, list);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Catalogue</h1>
          <p className="sub">
            {rows.length} références · {groups.size} catégories · prix de vente et coût d’achat en FCFA
          </p>
        </div>
      </div>

      {[...groups.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], "fr"))
        .map(([category, items]) => (
          <section className="card tight" key={category} style={{ marginBottom: 12 }}>
            <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0 }}>{category}</h2>
              <span className="tag">{items.length}</span>
              <span className="spacer" />
              <span className="muted small">
                valeur coût {formatXof(items.reduce((sum, item) => sum + item.stock_value_cost, 0))}
              </span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>SKU</th>
                  <th className="num">Coût</th>
                  <th className="num">Vente</th>
                  <th className="num">Marge</th>
                  <th className="num hide-sm">Seuil</th>
                  <th className="num">Dispo.</th>
                  <th>État</th>
                  <th className="hide-sm">Fournisseur</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const margin = row.sale_price - row.cost_price;
                  const marginPct = row.cost_price > 0 ? Math.round((margin / row.cost_price) * 100) : null;
                  return (
                    <tr key={row.variant_id}>
                      <td style={{ fontWeight: 550 }}>{row.name}</td>
                      <td className="mono">{row.sku}</td>
                      <td className="num muted">{formatXof(row.cost_price)}</td>
                      <td className="num">{formatXof(row.sale_price)}</td>
                      <td className="num">
                        {formatXof(margin)}
                        {marginPct !== null ? <div className="muted small">{marginPct} %</div> : null}
                      </td>
                      <td className="num hide-sm muted">{row.reorder_point} {row.unit}</td>
                      <td className="num">{row.available}</td>
                      <td><StatusPill status={row.status} /></td>
                      <td className="hide-sm muted small">
                        {supplierName.get(row.supplier_id ?? "") ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
    </>
  );
}

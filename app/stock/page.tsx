import { getDataSource } from "@/lib/data/repository";
import { computeKpis, OP_LABELS } from "@/lib/data/logic";
import { formatXof } from "@/lib/money";
import { Kpi, LinkButton, StatusPill } from "@/components/ui";
import { StockFilters } from "./StockFilters";

export const dynamic = "force-dynamic";

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; state?: string; cat?: string }>;
}) {
  const params = await searchParams;
  const source = getDataSource();
  const [rows, tenant, categories] = await Promise.all([
    source.getRows(),
    source.getTenant(),
    source.getCategories(),
  ]);
  const kpis = computeKpis(rows);

  const query = (params.q ?? "").toLowerCase().trim();
  const state = params.state ?? "all";
  const category = params.cat ?? "all";

  const filtered = rows.filter((row) => {
    const matchQuery =
      query.length === 0 ||
      row.name.toLowerCase().includes(query) ||
      row.sku.toLowerCase().includes(query);
    const matchState = state === "all" || row.status === state;
    const matchCategory = category === "all" || row.category_id === category;
    return matchQuery && matchState && matchCategory;
  });

  const totalCost = filtered.reduce((sum, row) => sum + row.stock_value_cost, 0);
  const totalSale = filtered.reduce((sum, row) => sum + row.stock_value_sale, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Stock</h1>
          <p className="sub">
            {filtered.length} référence(s) affichée(s) sur {kpis.skus} · dépôt {rows[0]?.location_name ?? "—"}
          </p>
        </div>
        <div className="row">
          <LinkButton href="/operations">Réception / sortie</LinkButton>
        </div>
      </div>

      <div className="grid c4" style={{ marginBottom: 12 }}>
        <Kpi label="Ruptures" value={String(kpis.out)} tone={kpis.out ? "bad" : "good"} hint="disponible = 0" />
        <Kpi label="Sous le seuil" value={String(kpis.low)} tone={kpis.low ? "warn" : "good"} hint="à commander bientôt" />
        <Kpi label="Valeur sélection (coût)" value={formatXof(totalCost)} hint={`${formatXof(totalSale)} en vente`} />
        <Kpi
          label="Marge potentielle"
          value={formatXof(totalSale - totalCost)}
          hint={totalCost > 0 ? `${Math.round(((totalSale - totalCost) / totalCost) * 100)} % sur coût` : "—"}
        />
      </div>

      <StockFilters categories={categories.map((c) => ({ id: c.id, name: c.name }))} />

      <div className="card tight">
        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th>Catégorie</th>
              <th className="num">Dispo.</th>
              <th className="num hide-sm">Réservé</th>
              <th className="num">Seuil</th>
              <th className="num">Couverture</th>
              <th>État</th>
              <th className="num">Valeur coût</th>
              <th className="num hide-sm">Prix vente</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className="empty">Aucun produit ne correspond à ce filtre.</div>
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.variant_id}>
                  <td>
                    <div style={{ fontWeight: 550 }}>{row.name}</div>
                    <div className="muted small mono">
                      {row.sku} · {row.unit}
                      {row.storage_label ? ` · ${row.storage_label}` : ""}
                    </div>
                  </td>
                  <td><span className="tag">{row.category_name}</span></td>
                  <td className={`num${row.available <= 0 ? " crit" : ""}`}>{row.available}</td>
                  <td className="num hide-sm muted">{row.reserved}</td>
                  <td className="num muted">{row.reorder_point}</td>
                  <td className="num">
                    {row.cover_days === null ? (
                      <span className="muted small">{row.issues_60d === 0 ? "aucun flux" : "—"}</span>
                    ) : (
                      <span className={row.cover_days < 10 ? "crit" : ""}>{row.cover_days} j</span>
                    )}
                  </td>
                  <td><StatusPill status={row.status} /></td>
                  <td className="num">{formatXof(row.stock_value_cost)}</td>
                  <td className="num hide-sm muted">{formatXof(row.sale_price)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="muted small" style={{ marginTop: 10 }}>
        Couverture = disponible ÷ consommation quotidienne moyenne sur 60 jours. Les produits sans
        sortie sur la période affichent « aucun flux » plutôt qu’une couverture infinie.
      </p>
    </>
  );
}

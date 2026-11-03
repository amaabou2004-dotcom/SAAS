import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRow,
  computeKpis,
  coverDays,
  dailyDemand,
  daysToStockout,
  sortByUrgency,
  stockStatus,
  suggestedOrder,
  turnover,
} from "../lib/data/logic.ts";
import { formatMoney, formatXof } from "../lib/money.ts";
import type { Product, StockRow } from "../lib/data/types.ts";

const product = (over: Partial<Product> = {}): Product => ({
  id: "p1",
  variant_id: "v1",
  name: "Riz parfumé 25 kg",
  sku: "RIZ-25",
  barcode: null,
  unit: "sac",
  category_id: "c1",
  supplier_id: "s1",
  sale_price: 19500,
  cost_price: 17500,
  reorder_point: 20,
  reorder_qty: 40,
  storage_label: null,
  active: true,
  ...over,
});

const row = (over: Partial<StockRow> = {}): StockRow => ({
  ...product(),
  on_hand: 50,
  reserved: 0,
  available: 50,
  issues_60d: 120,
  receipts_60d: 0,
  category_name: "Céréales & farines",
  supplier_name: "Coopérative Agricole Tillabéri",
  location_name: "Dépôt principal",
  status: "ok",
  stock_value_cost: 875000,
  stock_value_sale: 975000,
  cover_days: 25,
  ...over,
});

test("stockStatus distingue rupture, seuil et OK", () => {
  assert.equal(stockStatus(0, 20), "out");
  assert.equal(stockStatus(-3, 20), "out", "un disponible négatif reste une rupture");
  assert.equal(stockStatus(20, 20), "low", "au seuil exact on commande");
  assert.equal(stockStatus(21, 20), "ok");
});

test("la demande quotidienne est lissée sur 60 jours", () => {
  assert.equal(dailyDemand(120), 2);
  assert.equal(dailyDemand(0), 0);
});

test("coverDays renvoie null sans flux plutôt qu'un infini", () => {
  assert.equal(coverDays(50, 120), 25);
  assert.equal(coverDays(0, 120), 0);
  assert.equal(coverDays(50, 0), null);
});

test("suggestedOrder respecte le lot et le manque réel", () => {
  // 3 en stock, seuil 20, lot 40 -> 40 (lot minimum)
  assert.equal(suggestedOrder(3, 20, 40), 40);
  // 18 en stock, seuil 20, lot 5 -> 5 (le lot couvre le manque de 2)
  assert.equal(suggestedOrder(18, 20, 5), 5);
  // au-dessus du seuil -> rien
  assert.equal(suggestedOrder(21, 20, 40), 0);
  // manque plus grand que le lot -> on arrondit au manque
  assert.equal(suggestedOrder(0, 120, 40), 120);
});

test("daysToStockout et turnover gèrent l'absence de flux", () => {
  assert.equal(daysToStockout(50, 120), 25);
  assert.equal(daysToStockout(50, 0), null);
  assert.equal(turnover(120, 0), null);
  // 120 sorties / 60 j = 2/j => 730/an pour 50 en stock => 14,6
  assert.equal(turnover(120, 50), 14.6);
});

test("buildRow calcule disponible, valorisation et statut", () => {
  const built = buildRow({
    product: product({ reorder_point: 20 }),
    on_hand: 30,
    reserved: 12,
    issues_60d: 120,
    receipts_60d: 40,
    category_name: "Céréales & farines",
    supplier_name: null,
    location_name: "Dépôt principal",
  });
  assert.equal(built.available, 18);
  assert.equal(built.status, "low", "18 disponibles pour un seuil de 20");
  assert.equal(built.stock_value_cost, 30 * 17500);
  assert.equal(built.stock_value_sale, 30 * 19500);
  assert.equal(built.cover_days, 9, "18 / 2 par jour");
});

test("sortByUrgency place les ruptures d'abord puis les couvertures courtes", () => {
  const rows = [
    row({ variant_id: "a", name: "A", status: "ok", cover_days: 40 }),
    row({ variant_id: "b", name: "B", status: "out", cover_days: 0 }),
    row({ variant_id: "c", name: "C", status: "low", cover_days: 12 }),
    row({ variant_id: "d", name: "D", status: "low", cover_days: 3 }),
    row({ variant_id: "e", name: "E", status: "ok", cover_days: 5 }),
  ];
  assert.deepEqual(
    sortByUrgency(rows).map((item) => item.variant_id),
    ["b", "d", "c", "e", "a"],
  );
});

test("computeKpis agrège ruptures, valeur et coût de réassort", () => {
  const kpis = computeKpis([
    row({ variant_id: "a", status: "out", available: 0, stock_value_cost: 0, stock_value_sale: 0 }),
    row({ variant_id: "b", status: "low", available: 5, stock_value_cost: 100000, stock_value_sale: 120000 }),
    row({ variant_id: "c", status: "ok", available: 500, stock_value_cost: 900000, stock_value_sale: 1000000 }),
  ]);
  assert.equal(kpis.skus, 3);
  assert.equal(kpis.out, 1);
  assert.equal(kpis.low, 1);
  assert.equal(kpis.ok, 1);
  assert.equal(kpis.value_cost, 1000000);
  assert.equal(kpis.value_sale, 1120000);
  assert.equal(kpis.potential_margin, 120000);
  // a : seuil 20 lot 40 -> 40 ; b : 5 -> 40 ; c : au-dessus -> 0
  assert.equal(kpis.to_reorder, 2);
  assert.equal(kpis.reorder_cost, 80 * 17500);
});

test("formatXof et formatMoney restent lisibles", () => {
  assert.equal(formatXof(1234567), "1\u202F234\u202F567\u00A0FCFA");
  assert.equal(formatXof(-2500), "-2\u202F500\u00A0FCFA");
  assert.equal(formatMoney(19500), "19\u202F500\u00A0FCFA");
  assert.equal(formatMoney(1234.5, "EUR"), "1\u202F234,50\u00A0EUR");
});

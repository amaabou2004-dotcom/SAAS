import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  computeInvoice,
  convert,
  daysBetween,
  formatXof,
  nextBusinessDay,
  roundXof,
} from "../lib/money.ts";

test("formatXof utilise le séparateur de milliers UEMOA", () => {
  assert.equal(formatXof(1234567), "1\u202F234\u202F567\u00A0FCFA");
  assert.equal(formatXof(0), "0\u00A0FCFA");
  assert.equal(formatXof(-2500), "-2\u202F500\u00A0FCFA");
});

test("roundXof arrondit au franc entier", () => {
  assert.equal(roundXof(1234.4), 1234);
  assert.equal(roundXof(1234.5), 1235);
});

test("convert arrondit au franc quand la cible est XOF", () => {
  assert.equal(convert(100, 655.957, "XOF"), 65596);
  assert.equal(convert(10, 1.0855, "USD"), 10.85);
});

test("computeInvoice calcule HT, TVA et TTC en FCFA", () => {
  const totals = computeInvoice({
    amount: 1000,
    currency: "EUR",
    rateToXof: 655.957,
    vatRate: 0.19,
    dueInDays: 15,
    issueDate: "2026-10-20",
  });
  assert.equal(totals.htXof, 655957);
  assert.equal(totals.vatXof, 124632);
  assert.equal(totals.ttcXof, 780589);
});

test("addDays travaille en UTC et traverse les mois", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(daysBetween("2026-10-01", "2026-10-31"), 30);
});

test("nextBusinessDay saute week-end et jours fériés", () => {
  // 2026-11-01 est un dimanche -> lundi 02
  assert.equal(nextBusinessDay("2026-11-01", []), "2026-11-02");
  // 2026-11-02 est un lundi férié -> mardi 03
  assert.equal(nextBusinessDay("2026-11-02", ["2026-11-02"]), "2026-11-03");
  // Vendredi ouvré : inchangé
  assert.equal(nextBusinessDay("2026-10-30", []), "2026-10-30");
  // 2026-12-26 est un samedi -> lundi 28
  assert.equal(nextBusinessDay("2026-12-26", []), "2026-12-28");
  // Chaîne férié + week-end : ven 25 férié, sam 26, dim 27 -> lundi 28
  assert.equal(nextBusinessDay("2026-12-25", ["2026-12-25", "2026-12-28"]), "2026-12-29");
});

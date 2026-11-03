import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Colonnes réellement exposées par le schéma public du projet Supabase
 * (relevées via information_schema le 2026-11-03). Ces tests empêchent une
 * régression silencieuse : PostgREST renvoie une erreur 400 si l'on demande
 * une colonne inexistante, et l'écran tomberait en mode démo sans explication.
 */
const SCHEMA: Record<string, string[]> = {
  tenants: [
    "id", "name", "slug", "currency_code", "timezone", "status", "address", "phone",
    "created_at", "updated_at",
  ],
  products: [
    "id", "tenant_id", "category_id", "name", "description", "sale_price", "cost_price",
    "active", "created_at", "updated_at", "supplier_id",
  ],
  product_variants: [
    "id", "tenant_id", "product_id", "sku", "barcode", "attributes", "active",
    "created_at", "updated_at", "unit", "reorder_point", "reorder_qty", "storage_label",
  ],
  categories: ["id", "tenant_id", "name", "active", "created_at", "updated_at"],
  suppliers: [
    "id", "tenant_id", "name", "contact", "phone", "email", "city", "lead_time_days",
    "notes", "active", "created_at", "updated_at",
  ],
  stock_locations: ["id", "tenant_id", "name", "code", "active", "created_at", "updated_at"],
  stock_balances: ["tenant_id", "variant_id", "location_id", "on_hand", "reserved", "updated_at"],
  stock_operations: [
    "id", "tenant_id", "operation_type", "status", "idempotency_key", "request_fingerprint",
    "actor_user_id", "reason", "reference", "reverses_operation_id", "created_at",
  ],
  stock_movements: [
    "id", "tenant_id", "operation_id", "variant_id", "location_id", "quantity_delta",
    "on_hand_after", "reserved_after", "created_at",
  ],
  stock_overview: [
    "tenant_id", "variant_id", "location_id", "product_id", "product_name", "sku",
    "location_name", "location_code", "on_hand", "reserved", "available", "updated_at",
  ],
  stock_movement_history: [
    "id", "tenant_id", "operation_id", "operation_type", "operation_status",
    "actor_user_id", "reason", "reference", "reverses_operation_id", "variant_id",
    "location_id", "product_id", "product_name", "sku", "location_name", "location_code",
    "quantity_delta", "on_hand_after", "reserved_after", "created_at",
  ],
};

/** Extrait les listes de colonnes de chaque `select=` d'un fichier source. */
function extractSelects(file: string): string[][] {
  const source = readFileSync(file, "utf8");
  return [...source.matchAll(/[?&]select=([^`"'&]+)/g)].map((match) =>
    match[1]
      .split(",")
      .map((column) => column.trim())
      .filter(Boolean),
  );
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoFile = join(root, "lib", "data", "repository.ts");

test("les selects de repository.ts n'utilisent que des colonnes existantes", () => {
  const known = new Set(Object.values(SCHEMA).flat());
  const selects = extractSelects(repoFile);
  assert.ok(selects.length > 0, "aucun select= trouvé");

  for (const columns of selects) {
    for (const name of columns) {
      // `select=*` est valide et renvoie toutes les colonnes de la table.
      if (name === "*") continue;
      assert.match(name, /^[a-z0-9_]+$/, `colonne mal formée : ${name}`);
      assert.ok(known.has(name), `colonne inconnue dans un select PostgREST : ${name}`);
    }
  }
});

test("stock_movement_history expose operation_status et operation_id, pas status/id", () => {
  const columns = SCHEMA.stock_movement_history;
  assert.ok(columns.includes("operation_status"));
  assert.ok(columns.includes("operation_id"));
  assert.ok(!columns.includes("status"), "status n'existe pas dans la vue");
  assert.ok(!columns.includes("id_operation"));
});

test("stock_overview fournit available et location_name pour l'écran Stock", () => {
  const columns = SCHEMA.stock_overview;
  for (const required of ["variant_id", "product_id", "available", "on_hand", "reserved", "location_name"]) {
    assert.ok(columns.includes(required), `colonne manquante : ${required}`);
  }
});

test("le select des opérations passe par la vue (pas de jointure implicite)", () => {
  const source = readFileSync(repoFile, "utf8");
  assert.match(source, /\/stock_movement_history\?tenant_id=eq\./);
  assert.match(source, /operation_status/);
  assert.doesNotMatch(
    source,
    /stock_movement_history[^`]*select=id,operation_type,status,/,
    "ancienne colonne status encore demandée",
  );
});

test("getWeekly compte les opérations distinctes par semaine", () => {
  const source = readFileSync(repoFile, "utf8");
  assert.match(source, /seenOperations/, "dédoublonnage par operation_id attendu");
  assert.match(source, /entry\.issues \+= -quantity/);
  assert.match(source, /entry\.receipts \+= quantity/);
});

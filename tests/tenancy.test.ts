import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidSlug, pickActiveTenantId, slugify } from "../lib/data/tenancy-helpers.ts";

test("slugify produit un slug d'URL conforme au contrainte SQL", () => {
  assert.equal(slugify("Kanti Démo SARL"), "kanti-demo-sarl");
  assert.equal(slugify("  Sahel Hygiène & Entretien "), "sahel-hygiene-entretien");
  assert.equal(slugify("Épicerie—Niamey"), "epicerie-niamey");
  assert.equal(slugify("a"), "a"); // trop court, mais isValidSlug le refuse
});

test("slugify tronque à 63 caractères et ne laisse pas de tiret final", () => {
  const long = slugify("x".repeat(200));
  assert.equal(long.length, 63);
  const trailing = slugify(`${"a".repeat(62)} !!`);
  assert.ok(!trailing.endsWith("-"), "pas de tiret en fin de slug");
  assert.ok(isValidSlug(trailing));
});

test("isValidSlug applique les règles du RPC create_tenant", () => {
  assert.equal(isValidSlug("kanti-demo-sarl"), true);
  assert.equal(isValidSlug("a"), false, "2 caractères minimum");
  assert.equal(isValidSlug("Kanti"), false, "majuscules interdites");
  assert.equal(isValidSlug("kanti--demo"), false, "pas de double tiret");
  assert.equal(isValidSlug("-kanti"), false, "pas de tiret initial");
  assert.equal(isValidSlug("kanti demo"), false, "pas d'espace");
  assert.equal(isValidSlug("k".repeat(64)), false, "63 caractères maximum");
});

test("pickActiveTenantId ignore un cookie forgé", () => {
  const tenants = [
    { id: "t1", slug: "a" },
    { id: "t2", slug: "b" },
  ];
  assert.equal(pickActiveTenantId(tenants, "t2"), "t2");
  assert.equal(pickActiveTenantId(tenants, "inconnu"), null, "plusieurs tenants, choix requis");
  assert.equal(pickActiveTenantId(tenants, undefined), null);
});

test("pickActiveTenantId sélectionne l'unique tenant sans cookie", () => {
  assert.equal(pickActiveTenantId([{ id: "t1", slug: "a" }], undefined), "t1");
  assert.equal(pickActiveTenantId([], "t1"), null);
});

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function StockFilters({ categories }: { categories: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const state = params.get("state") ?? "all";
  const category = params.get("cat") ?? "all";

  function push(next: Record<string, string>) {
    const merged = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") merged.delete(key);
      else merged.set(key, value);
    }
    router.push(`/stock?${merged.toString()}`);
  }

  return (
    <form
      className="filters"
      onSubmit={(event) => {
        event.preventDefault();
        push({ q: query });
      }}
    >
      <input
        className="grow"
        placeholder="Rechercher un produit ou un SKU…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Rechercher"
      />
      <select value={state} onChange={(event) => push({ state: event.target.value })} aria-label="État">
        <option value="all">Tous les états</option>
        <option value="out">Ruptures</option>
        <option value="low">Sous le seuil</option>
        <option value="ok">Stock OK</option>
      </select>
      <select value={category} onChange={(event) => push({ cat: event.target.value })} aria-label="Catégorie">
        <option value="all">Toutes catégories</option>
        {categories.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <button type="submit">Rechercher</button>
      {(query || state !== "all" || category !== "all") && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            router.push("/stock");
          }}
        >
          Réinitialiser
        </button>
      )}
    </form>
  );
}

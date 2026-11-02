import { fetchJson, withFallback, REVALIDATE, type Sourced } from "@/lib/http";

/**
 * Frankfurter — https://frankfurter.dev
 * Source : banques centrales (BCE + BCEAO pour le XOF). Aucune clé, aucun quota.
 * Doc des taux XOF : https://frankfurter.dev/providers/bceao/
 */

const BASE = "https://api.frankfurter.dev/v1";

export interface Rate {
  base: string;
  quote: string;
  rate: number;
  date: string;
}

type LatestResponse = {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
};

type SeriesResponse = {
  base: string;
  start_date: string;
  end_date: string;
  rates: Record<string, Record<string, number>>;
};

/** Parité fixe du franc CFA (1 EUR = 655,957 XOF), garantie par le Trésor français. */
export const XOF_PEG_EUR = 655.957;

const FALLBACK_RATES_TO_XOF: Record<string, number> = {
  XOF: 1,
  EUR: XOF_PEG_EUR,
  USD: XOF_PEG_EUR / 1.08,
  GBP: XOF_PEG_EUR / 0.85,
  CAD: XOF_PEG_EUR / 1.5,
  CNY: XOF_PEG_EUR / 7.8,
};

export function fallbackRate(base: string, quote: string): Rate {
  const b = base.toUpperCase();
  const q = quote.toUpperCase();
  const inXof = FALLBACK_RATES_TO_XOF[b] ?? 1;
  const outXof = FALLBACK_RATES_TO_XOF[q] ?? 1;
  return {
    base: b,
    quote: q,
    rate: Math.round((inXof / outXof) * 10000) / 10000,
    date: new Date().toISOString().slice(0, 10),
  };
}

export async function getRate(
  base = "EUR",
  quote = "XOF",
): Promise<Sourced<Rate>> {
  const b = base.toUpperCase();
  const q = quote.toUpperCase();
  if (b === q) {
    return {
      data: { base: b, quote: q, rate: 1, date: new Date().toISOString().slice(0, 10) },
      source: "live",
      fetchedAt: new Date().toISOString(),
    };
  }
  return withFallback(
    "Frankfurter",
    async () => {
      const url = `${BASE}/latest?base=${encodeURIComponent(b)}&symbols=${encodeURIComponent(q)}`;
      const json = await fetchJson<LatestResponse>(url, REVALIDATE.fx);
      const rate = json.rates?.[q];
      if (typeof rate !== "number") throw new Error(`taux ${b}/${q} absent de la réponse`);
      return { base: b, quote: q, rate, date: json.date };
    },
    () => fallbackRate(b, q),
  );
}

export interface SeriesPoint {
  date: string;
  rate: number;
}

/** Historique quotidien sur `days` jours (endpoint time series de Frankfurter). */
export async function getSeries(
  base = "EUR",
  quote = "XOF",
  days = 30,
): Promise<Sourced<SeriesPoint[]>> {
  const b = base.toUpperCase();
  const q = quote.toUpperCase();
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  return withFallback(
    "Frankfurter (série)",
    async () => {
      const url = `${BASE}/${iso(start)}..${iso(end)}?base=${encodeURIComponent(b)}&symbols=${encodeURIComponent(q)}`;
      const json = await fetchJson<SeriesResponse>(url, REVALIDATE.fx);
      const points = Object.entries(json.rates ?? {})
        .map(([date, rates]) => ({ date, rate: rates[q] }))
        .filter((p): p is SeriesPoint => typeof p.rate === "number")
        .sort((x, y) => x.date.localeCompare(y.date));
      if (points.length === 0) throw new Error("série vide");
      return points;
    },
    () => {
      const base_ = fallbackRate(b, q).rate;
      return Array.from({ length: days }, (_, i) => {
        const date = new Date(end.getTime() - (days - i) * 86_400_000)
          .toISOString()
          .slice(0, 10);
        // Parité fixe : quasi plat, avec un bruit déterministe pour la démo.
        const wobble = Math.sin(i / 3) * 0.0012;
        return { date, rate: Math.round(base_ * (1 + wobble) * 10000) / 10000 };
      });
    },
  );
}

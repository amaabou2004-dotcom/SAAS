/**
 * Appels HTTP sortants : timeout court, revalidation Next, et un marqueur
 * `source` qui distingue une donnée live d'un fallback local.
 */

export type Sourced<T> = {
  data: T;
  source: "live" | "fallback";
  fetchedAt: string;
  note?: string;
};

export const REVALIDATE = {
  fx: 3600, // les taux BCE/BCEAO changent une fois par jour ouvré
  holidays: 86_400,
  countries: 7 * 86_400,
} as const;

export async function fetchJson<T>(
  url: string,
  revalidate: number,
  timeoutMs = 4000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      next: { revalidate },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Enveloppe un appel réseau : bascule sur le fallback sans jamais throw. */
export async function withFallback<T>(
  label: string,
  call: () => Promise<T>,
  fallback: () => T,
): Promise<Sourced<T>> {
  try {
    const data = await call();
    return { data, source: "live", fetchedAt: new Date().toISOString() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      data: fallback(),
      source: "fallback",
      fetchedAt: new Date().toISOString(),
      note: `${label} indisponible (${message}) — données locales utilisées`,
    };
  }
}

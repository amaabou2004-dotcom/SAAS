import { fetchJson, withFallback, REVALIDATE, type Sourced } from "@/lib/http";
import { nextBusinessDay, addDays } from "@/lib/money";

/**
 * Nager.Date — https://date.nager.at
 * Jours fériés officiels, ~100 pays, aucune clé. Le Niger (NE) est couvert.
 */

const BASE = "https://date.nager.at/api/v3";

export interface Holiday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  global: boolean;
  types: string[];
}

/**
 * Échantillon local **non exhaustif** : sert uniquement de repli hors ligne
 * (les fêtes religieuses étant mobiles). Ne jamais l'utiliser comme source de vérité.
 */
const FALLBACK_NE: Holiday[] = [
  { date: "01-01", localName: "Nouvel An", name: "New Year's Day", countryCode: "NE", global: true, types: ["Public"] },
  { date: "04-24", localName: "Fête de la Concorde Nationale", name: "Concord Day", countryCode: "NE", global: true, types: ["Public"] },
  { date: "05-01", localName: "Fête du Travail", name: "Labour Day", countryCode: "NE", global: true, types: ["Public"] },
  { date: "08-03", localName: "Fête de l'Indépendance", name: "Independence Day", countryCode: "NE", global: true, types: ["Public"] },
  { date: "12-18", localName: "Fête de la République", name: "Republic Day", countryCode: "NE", global: true, types: ["Public"] },
  { date: "12-25", localName: "Noël", name: "Christmas Day", countryCode: "NE", global: true, types: ["Public"] },
];

export function fallbackHolidays(country: string, year: number): Holiday[] {
  return FALLBACK_NE.map((h) => ({ ...h, countryCode: country.toUpperCase(), date: `${year}-${h.date}` }));
}

export async function getHolidays(
  year: number,
  country = "NE",
): Promise<Sourced<Holiday[]>> {
  const code = country.toUpperCase();
  return withFallback(
    "Nager.Date",
    async () => {
      const url = `${BASE}/PublicHolidays/${year}/${encodeURIComponent(code)}`;
      const json = await fetchJson<Holiday[]>(url, REVALIDATE.holidays);
      if (!Array.isArray(json) || json.length === 0) throw new Error("aucun jour férié renvoyé");
      return json.filter((h) => h.global !== false).sort((a, b) => a.date.localeCompare(b.date));
    },
    () => fallbackHolidays(code, year),
  );
}

export interface Deadline {
  issueDate: string;
  nominalDueDate: string;
  dueDate: string;
  shifted: boolean;
  reason: string | null;
}

/**
 * Calcule une échéance de facture réaliste : + `dueInDays`, puis report au
 * prochain jour ouvré (ni dimanche, ni jour férié).
 */
export async function getDeadline(
  issueDate: string,
  dueInDays: number,
  country = "NE",
): Promise<{ deadline: Deadline; holidays: Sourced<Holiday[]> }> {
  const nominal = addDays(issueDate, dueInDays);
  const year = Number(nominal.slice(0, 4));
  const holidays = await getHolidays(year, country);
  const dates = holidays.data.map((h) => h.date);
  const dueDate = nextBusinessDay(nominal, dates);

  let reason: string | null = null;
  if (dueDate !== nominal) {
    const matched = holidays.data.find((h) => h.date === nominal);
    reason = matched
      ? `Reporté : ${matched.localName}`
      : "Reporté : week-end";
  }

  return {
    deadline: { issueDate, nominalDueDate: nominal, dueDate, shifted: dueDate !== nominal, reason },
    holidays,
  };
}

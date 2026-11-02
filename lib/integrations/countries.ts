import { fetchJson, withFallback, REVALIDATE, type Sourced } from "@/lib/http";

/**
 * REST Countries — https://restcountries.com
 * Sans clé. Sert au sélecteur pays/devise/langue de l'onboarding.
 */

const BASE = "https://restcountries.com/v3.1";
const FIELDS = "name,cca2,cca3,currencies,flag,capital,region";

export interface Country {
  name: string;
  code: string;
  currencyCode: string;
  currencySymbol?: string;
  flag: string;
  capital?: string;
}

type RawCountry = {
  name?: { common?: string; official?: string };
  cca2?: string;
  cca3?: string;
  currencies?: Record<string, { name?: string; symbol?: string }>;
  flag?: string;
  capital?: string[];
};

/** Les 8 pays de l'UEMOA + les principaux partenaires commerciaux du Niger. */
const FALLBACK: Country[] = [
  { name: "Niger", code: "NE", currencyCode: "XOF", flag: "🇳🇪", capital: "Niamey" },
  { name: "Sénégal", code: "SN", currencyCode: "XOF", flag: "🇸🇳", capital: "Dakar" },
  { name: "Côte d'Ivoire", code: "CI", currencyCode: "XOF", flag: "🇨🇮", capital: "Yamoussoukro" },
  { name: "Mali", code: "ML", currencyCode: "XOF", flag: "🇲🇱", capital: "Bamako" },
  { name: "Burkina Faso", code: "BF", currencyCode: "XOF", flag: "🇧🇫", capital: "Ouagadougou" },
  { name: "Bénin", code: "BJ", currencyCode: "XOF", flag: "🇧🇯", capital: "Porto-Novo" },
  { name: "Togo", code: "TG", currencyCode: "XOF", flag: "🇹🇬", capital: "Lomé" },
  { name: "Guinée-Bissau", code: "GW", currencyCode: "XOF", flag: "🇬🇼", capital: "Bissau" },
  { name: "France", code: "FR", currencyCode: "EUR", flag: "🇫🇷", capital: "Paris" },
  { name: "Nigeria", code: "NG", currencyCode: "NGN", flag: "🇳🇬", capital: "Abuja" },
  { name: "Ghana", code: "GH", currencyCode: "GHS", flag: "🇬🇭", capital: "Accra" },
  { name: "États-Unis", code: "US", currencyCode: "USD", flag: "🇺🇸", capital: "Washington, D.C." },
];

function normalize(raw: RawCountry): Country | null {
  if (!raw.cca2 || !raw.currencies) return null;
  const [currencyCode] = Object.keys(raw.currencies);
  return {
    name: raw.name?.common ?? raw.cca2,
    code: raw.cca2,
    currencyCode: currencyCode ?? "XOF",
    currencySymbol: raw.currencies[currencyCode]?.symbol,
    flag: raw.flag ?? "",
    capital: raw.capital?.[0],
  };
}

export async function getCountries(): Promise<Sourced<Country[]>> {
  return withFallback(
    "REST Countries",
    async () => {
      const url = `${BASE}/all?fields=${FIELDS}`;
      const json = await fetchJson<RawCountry[]>(url, REVALIDATE.countries, 6000);
      const countries = json.map(normalize).filter((c): c is Country => c !== null);
      if (countries.length < 50) throw new Error("réponse incomplète");
      return countries.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    },
    () => FALLBACK,
  );
}

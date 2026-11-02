import { fetchJson, withFallback, type Sourced } from "@/lib/http";

/**
 * Open-Meteo — https://open-meteo.com
 * Sans clé, ~10 000 req/jour, usage non commercial sur le tier gratuit.
 */

const BASE = "https://api.open-meteo.com/v1/forecast";

export interface Weather {
  temperature: number;
  apparent: number;
  humidity: number;
  wind: number;
  precipitation: number;
  code: number;
  label: string;
  max: number;
  min: number;
}

type Raw = {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    precipitation?: number;
    weather_code?: number;
  };
  daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] };
};

const LABELS: Record<number, string> = {
  0: "Ciel dégagé",
  1: "Plutôt dégagé",
  2: "Partiellement nuageux",
  3: "Couvert",
  45: "Brouillard",
  48: "Brouillard givrant",
  51: "Bruine légère",
  53: "Bruine",
  55: "Bruine dense",
  61: "Pluie faible",
  63: "Pluie",
  65: "Pluie forte",
  80: "Averses",
  81: "Averses modérées",
  82: "Averses violentes",
  95: "Orage",
  96: "Orage avec grêle",
};

export const weatherLabel = (code: number) => LABELS[code] ?? `Code ${code}`;

export async function getWeather(
  latitude = 13.5137,
  longitude = 2.1098,
): Promise<Sourced<Weather & { city: string }>> {
  const city = Math.abs(latitude - 13.5137) < 0.2 && Math.abs(longitude - 2.1098) < 0.2
    ? "Niamey"
    : `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;

  return withFallback(
    "Open-Meteo",
    async () => {
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation,weather_code",
        daily: "temperature_2m_max,temperature_2m_min",
        timezone: "auto",
      });
      const json = await fetchJson<Raw>(`${BASE}?${params}`, 900);
      const c = json.current;
      if (!c || typeof c.temperature_2m !== "number") throw new Error("réponse sans température");
      return {
        city,
        temperature: c.temperature_2m,
        apparent: c.apparent_temperature ?? c.temperature_2m,
        humidity: c.relative_humidity_2m ?? 0,
        wind: c.wind_speed_10m ?? 0,
        precipitation: c.precipitation ?? 0,
        code: c.weather_code ?? 0,
        label: weatherLabel(c.weather_code ?? 0),
        max: json.daily?.temperature_2m_max?.[0] ?? c.temperature_2m,
        min: json.daily?.temperature_2m_min?.[0] ?? c.temperature_2m,
      };
    },
    () => ({
      city,
      temperature: 34,
      apparent: 38,
      humidity: 42,
      wind: 12,
      precipitation: 0,
      code: 0,
      label: weatherLabel(0),
      max: 37,
      min: 26,
    }),
  );
}

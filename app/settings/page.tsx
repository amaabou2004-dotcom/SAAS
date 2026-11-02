import { getRate } from "@/lib/integrations/frankfurter";
import { getHolidays } from "@/lib/integrations/nager";
import { getCountries } from "@/lib/integrations/countries";
import { getWeather } from "@/lib/integrations/weather";
import { SourceBadge } from "@/components/ui";

export const revalidate = 900;

const ROWS = [
  {
    name: "Frankfurter",
    role: "Taux de change (BCE + BCEAO)",
    endpoint: "api.frankfurter.dev",
    docs: "https://frankfurter.dev",
    key: "aucune",
    quota: "pas de quota (fair use)",
    code: "lib/integrations/frankfurter.ts",
  },
  {
    name: "Nager.Date",
    role: "Jours fériés (Niger couvert)",
    endpoint: "date.nager.at",
    docs: "https://date.nager.at/swagger/index.html",
    key: "aucune",
    quota: "généreux, cache 24 h",
    code: "lib/integrations/nager.ts",
  },
  {
    name: "REST Countries",
    role: "Pays, devises, drapeaux",
    endpoint: "restcountries.com",
    docs: "https://restcountries.com",
    key: "aucune",
    quota: "fair use, cache 7 j",
    code: "lib/integrations/countries.ts",
  },
  {
    name: "Open-Meteo",
    role: "Météo actuelle",
    endpoint: "api.open-meteo.com",
    docs: "https://open-meteo.com/en/docs",
    key: "aucune",
    quota: "10 000 req/jour (non commercial)",
    code: "lib/integrations/weather.ts",
  },
];

export default async function SettingsPage() {
  const [rate, holidays, countries, weather] = await Promise.all([
    getRate("EUR", "XOF"),
    getHolidays(new Date().getFullYear(), "NE"),
    getCountries(),
    getWeather(),
  ]);

  const statuses = [
    { ...rate, detail: `1 EUR = ${rate.data.rate.toLocaleString("fr-FR")} XOF` },
    { ...holidays, detail: `${holidays.data.length} jour(s) férié(s) pour ${new Date().getFullYear()}` },
    { ...countries, detail: `${countries.data.length} pays normalisés` },
    { ...weather, detail: `${Math.round(weather.data.temperature)}°C à ${weather.data.city}` },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Intégrations</h1>
          <p className="sub">
            Les 4 APIs de <code>public-apis</code> retenues pour ce SaaS. Aucune clé à gérer.
          </p>
        </div>
      </div>

      <div className="grid k4" style={{ marginBottom: 16 }}>
        {statuses.map((status, index) => (
          <div className="card" key={ROWS[index].name}>
            <div className="kpi-label">{ROWS[index].name}</div>
            <div style={{ margin: "4px 0 8px" }}>
              <SourceBadge source={status.source} note={status.note} />
            </div>
            <div style={{ fontSize: 13.5 }}>{status.detail}</div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
              {status.fetchedAt.slice(11, 19)} UTC
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
        <table>
          <thead>
            <tr>
              <th style={{ paddingTop: 16 }}>API</th>
              <th style={{ paddingTop: 16 }}>Usage</th>
              <th style={{ paddingTop: 16 }}>Clé</th>
              <th style={{ paddingTop: 16 }}>Quota</th>
              <th style={{ paddingTop: 16 }}>Code</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.name}>
                <td>
                  <div style={{ fontWeight: 550 }}>{row.name}</div>
                  <a href={row.docs} target="_blank" rel="noreferrer" className="muted" style={{ fontSize: 12 }}>
                    {row.endpoint} ↗
                  </a>
                </td>
                <td>{row.role}</td>
                <td><span className="badge paid">aucune</span></td>
                <td className="muted" style={{ fontSize: 12.5 }}>{row.quota}</td>
                <td className="mono muted" style={{ fontSize: 12 }}>{row.code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Points d&apos;architecture</h2>
        <ul className="list-clean">
          <li>
            <span className="muted">Appels API</span>
            <span>100 % côté serveur (route handlers Next.js)</span>
          </li>
          <li>
            <span className="muted">Cache</span>
            <span>ISR : 1 h taux, 24 h fériés, 7 j pays, 15 min météo</span>
          </li>
          <li>
            <span className="muted">Résilience</span>
            <span>Timeout 4 s + repli local, jamais de page en erreur</span>
          </li>
          <li>
            <span className="muted">Stockage</span>
            <span>En mémoire — à remplacer par Supabase / Postgres</span>
          </li>
          <li>
            <span className="muted">Clés</span>
            <span>Aucune : rien à faire fuiter dans le bundle JS</span>
          </li>
        </ul>
      </div>
    </>
  );
}

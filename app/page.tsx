import Link from "next/link";
import { getRate, getSeries } from "@/lib/integrations/frankfurter";
import { getHolidays } from "@/lib/integrations/nager";
import { getWeather } from "@/lib/integrations/weather";
import { listInvoices } from "@/lib/store";
import { formatMoney, formatXof } from "@/lib/money";
import { CtaLink, SourceBadge, Sparkline, StatusBadge } from "@/components/ui";

export const revalidate = 900;

export default async function DashboardPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [rate, series, holidays, weather] = await Promise.all([
    getRate("EUR", "XOF"),
    getSeries("EUR", "XOF", 30),
    getHolidays(new Date().getFullYear(), "NE"),
    getWeather(),
  ]);

  const invoices = listInvoices();
  const kpis = {
    billed: invoices.reduce((s, i) => s + i.ttcXof, 0),
    paid: invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.ttcXof, 0),
    pending: invoices.filter((i) => i.status === "sent").reduce((s, i) => s + i.ttcXof, 0),
    overdue: invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.ttcXof, 0),
  };
  const upcoming = holidays.data.filter((h) => h.date >= today).slice(0, 4);
  const seriesValues = series.data.map((p) => p.rate);
  const variation =
    seriesValues.length > 1
      ? ((seriesValues[seriesValues.length - 1] - seriesValues[0]) / seriesValues[0]) * 100
      : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tableau de bord</h1>
          <p className="sub">
            Facturation en FCFA · {weather.data.city} · {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <CtaLink href="/invoices/new">+ Nouvelle facture</CtaLink>
      </div>

      <div className="grid k4" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="kpi-label">Encaissé</div>
          <div className="kpi-value good">{formatXof(kpis.paid)}</div>
          <div className="kpi-hint">sur {formatXof(kpis.billed)} facturés</div>
        </div>
        <div className="card">
          <div className="kpi-label">En attente</div>
          <div className="kpi-value warn">{formatXof(kpis.pending)}</div>
          <div className="kpi-hint">factures envoyées, non réglées</div>
        </div>
        <div className="card">
          <div className="kpi-label">En retard</div>
          <div className="kpi-value bad">{formatXof(kpis.overdue)}</div>
          <div className="kpi-hint">à relancer en priorité</div>
        </div>
        <div className="card">
          <div className="kpi-label">Taux EUR → XOF</div>
          <div className="kpi-value mono">{rate.data.rate.toLocaleString("fr-FR")}</div>
          <div className="kpi-hint">
            <SourceBadge source={rate.source} note={rate.note} />{" "}
            <span className={variation >= 0 ? "muted" : "muted"}>
              {variation >= 0 ? "+" : ""}
              {variation.toFixed(2)} % / 30 j
            </span>
          </div>
        </div>
      </div>

      <div className="grid k2" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="row" style={{ marginBottom: 4 }}>
            <h2 style={{ margin: 0 }}>Parité EUR / XOF</h2>
            <span className="spacer" />
            <SourceBadge source={series.source} note={series.note} />
          </div>
          <p className="muted" style={{ fontSize: 12.5, margin: "0 0 12px" }}>
            Banque Centrale des États de l&apos;Afrique de l&apos;Ouest, via Frankfurter · 30 derniers jours
          </p>
          <Sparkline points={seriesValues} />
          <div className="row" style={{ justifyContent: "space-between", fontSize: 12.5, marginTop: 6 }}>
            <span className="muted">{series.data[0]?.date}</span>
            <span className="mono">
              min {Math.min(...seriesValues).toFixed(3)} · max {Math.max(...seriesValues).toFixed(3)}
            </span>
            <span className="muted">{series.data[series.data.length - 1]?.date}</span>
          </div>
        </section>

        <section className="card">
          <div className="row" style={{ marginBottom: 4 }}>
            <h2 style={{ margin: 0 }}>Jours fériés — Niger</h2>
            <span className="spacer" />
            <SourceBadge source={holidays.source} note={holidays.note} />
          </div>
          <p className="muted" style={{ fontSize: 12.5, margin: "0 0 8px" }}>
            Les échéances de facture sont automatiquement reportées au jour ouvré suivant.
          </p>
          {upcoming.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Aucun jour férié à venir cette année.</p>
          ) : (
            <ul className="list-clean">
              {upcoming.map((h) => (
                <li key={`${h.date}-${h.name}`}>
                  <span>{h.localName}</span>
                  <span className="mono muted">{h.date}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid k2" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="row" style={{ marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>Factures récentes</h2>
            <span className="spacer" />
            <Link href="/invoices" className="muted" style={{ fontSize: 12.5 }}>Tout voir →</Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Statut</th>
                <th className="num">TTC</th>
              </tr>
            </thead>
            <tbody>
              {invoices.slice(0, 5).map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <Link href={`/invoices/${invoice.id}`}>
                      <div style={{ fontWeight: 550 }}>{invoice.client}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {invoice.number} · échéance {invoice.dueDate}
                        {invoice.dueShiftReason ? " (reportée)" : ""}
                      </div>
                    </Link>
                  </td>
                  <td><StatusBadge status={invoice.status} /></td>
                  <td className="num">{formatXof(invoice.ttcXof)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Météo {weather.data.city}</h2>
            <span className="spacer" />
            <SourceBadge source={weather.source} note={weather.note} />
          </div>
          <div className="row" style={{ gap: 18, alignItems: "baseline" }}>
            <div style={{ fontSize: 34, fontWeight: 650, letterSpacing: -1 }}>
              {Math.round(weather.data.temperature)}°
            </div>
            <div>
              <div style={{ fontWeight: 550 }}>{weather.data.label}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                ressenti {Math.round(weather.data.apparent)}° · max {Math.round(weather.data.max)}° / min{" "}
                {Math.round(weather.data.min)}°
              </div>
            </div>
          </div>
          <ul className="list-clean" style={{ marginTop: 14 }}>
            <li><span className="muted">Humidité</span><span className="mono">{weather.data.humidity} %</span></li>
            <li><span className="muted">Vent</span><span className="mono">{weather.data.wind} km/h</span></li>
            <li><span className="muted">Précipitations</span><span className="mono">{weather.data.precipitation} mm</span></li>
          </ul>
          <p className="muted" style={{ fontSize: 11.5, marginTop: 12, marginBottom: 0 }}>
            Open-Meteo · tier gratuit non commercial, 10 000 req/jour
          </p>
        </section>
      </div>

      <section className="card">
        <h2>Dernière facture en devise étrangère</h2>
        {(() => {
          const foreign = invoices.find((i) => i.currency !== "XOF");
          if (!foreign) return <p className="muted" style={{ fontSize: 13 }}>Aucune facture en devise étrangère.</p>;
          return (
            <div className="row" style={{ gap: 24, flexWrap: "wrap" }}>
              <div>
                <div className="kpi-label">Montant facturé</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  {formatMoney(foreign.amount, foreign.currency)}
                </div>
              </div>
              <div>→</div>
              <div>
                <div className="kpi-label">Équivalent FCFA</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{formatXof(foreign.htXof)}</div>
              </div>
              <div>
                <div className="kpi-label">TVA</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{formatXof(foreign.vatXof)}</div>
              </div>
              <div>
                <div className="kpi-label">TTC</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "var(--accent)" }}>
                  {formatXof(foreign.ttcXof)}
                </div>
              </div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                taux appliqué : {foreign.rateToXof.toLocaleString("fr-FR")} XOF / {foreign.currency}
                <br />
                <SourceBadge source={foreign.source} />
              </div>
            </div>
          );
        })()}
      </section>
    </>
  );
}

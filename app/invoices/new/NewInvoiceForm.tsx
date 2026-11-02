"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Country } from "@/lib/integrations/countries";
import { XOF_PEG_EUR } from "@/lib/integrations/frankfurter";
import { formatXof } from "@/lib/money";

const CURRENCIES = ["XOF", "EUR", "USD", "GBP", "CAD", "CNY"];
const VAT_BY_COUNTRY: Record<string, number> = {
  NE: 19, SN: 18, CI: 18, ML: 18, BF: 18, BJ: 18, TG: 18, GW: 18, FR: 20, NG: 7.5, GH: 15, US: 0,
};

type RateState = { rate: number; source: "live" | "fallback"; date: string } | null;

export function NewInvoiceForm({
  countries,
  countriesSource,
}: {
  countries: Country[];
  countriesSource: "live" | "fallback";
}) {
  const router = useRouter();
  const [client, setClient] = useState("");
  const [country, setCountry] = useState("NE");
  const [currency, setCurrency] = useState("XOF");
  const [amount, setAmount] = useState("250000");
  const [dueInDays, setDueInDays] = useState(15);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [rate, setRate] = useState<RateState>(null);
  const [deadline, setDeadline] = useState<{ dueDate: string; reason: string | null } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  const vatPercent = VAT_BY_COUNTRY[country] ?? 0;
  const numericAmount = Number(amount.replace(/\s/g, "").replace(",", ".")) || 0;

  // Taux : parité fixe pour l'euro, sinon API Frankfurter.
  useEffect(() => {
    let cancelled = false;
    if (currency === "XOF") {
      setRate({ rate: 1, source: "live", date: issueDate });
      return;
    }
    setRate(null);
    fetch(`/api/rates?base=${currency}&quote=XOF&days=7`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        setRate({ rate: json.rate.data.rate, source: json.rate.source, date: json.rate.data.date });
      })
      .catch(() => {
        if (!cancelled) setRate({ rate: currency === "EUR" ? XOF_PEG_EUR : NaN, source: "fallback", date: issueDate });
      });
    return () => {
      cancelled = true;
    };
  }, [currency, issueDate]);

  // Échéance reportée au jour ouvré suivant.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/holidays?country=${country}&issueDate=${issueDate}&dueInDays=${dueInDays}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setDeadline({ dueDate: json.deadline.dueDate, reason: json.deadline.reason });
      })
      .catch(() => {
        if (!cancelled) setDeadline(null);
      });
    return () => {
      cancelled = true;
    };
  }, [country, issueDate, dueInDays]);

  const preview = useMemo(() => {
    if (!rate || !Number.isFinite(rate.rate)) return null;
    const htXof = Math.round(numericAmount * rate.rate);
    const vatXof = Math.round(htXof * (vatPercent / 100));
    return { htXof, vatXof, ttcXof: htXof + vatXof };
  }, [numericAmount, rate, vatPercent]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors([]);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client,
        country,
        currency,
        amount: numericAmount,
        dueInDays,
        issueDate,
        vatRate: vatPercent / 100,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErrors(json.errors ?? [json.error ?? "Erreur inconnue"]);
      setPending(false);
      return;
    }
    router.push(`/invoices/${json.invoice.id}`);
    router.refresh();
  }

  return (
    <div className="grid k2" style={{ alignItems: "start" }}>
      <form className="card" onSubmit={submit}>
        {errors.length > 0 && (
          <div className="alert error">
            {errors.map((error) => (
              <div key={error}>• {error}</div>
            ))}
          </div>
        )}

        <div className="field">
          <label htmlFor="client">Client</label>
          <input
            id="client"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="Ex. Sahel Logistics SARL"
            required
            minLength={2}
          />
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="country">
              Pays{" "}
              <span className="muted" style={{ fontWeight: 400 }}>
                ({countriesSource === "live" ? "REST Countries" : "liste locale"})
              </span>
            </label>
            <select id="country" value={country} onChange={(e) => setCountry(e.target.value)}>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name} ({c.currencyCode})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="currency">Devise de facturation</label>
            <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="amount">Montant HT ({currency})</label>
            <input
              id="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="issueDate">Date d&apos;émission</label>
            <input
              id="issueDate"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="due">Délai de paiement (jours)</label>
            <input
              id="due"
              type="number"
              min={1}
              max={180}
              value={dueInDays}
              onChange={(e) => setDueInDays(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>TVA (auto selon pays)</label>
            <input value={`${vatPercent} %`} readOnly />
          </div>
        </div>

        <button type="submit" className="primary" disabled={pending || !preview} style={{ width: "100%" }}>
          {pending ? "Création…" : "Créer la facture"}
        </button>
      </form>

      <div className="card">
        <h2>Aperçu du calcul</h2>
        <ul className="list-clean">
          <li>
            <span className="muted">Montant HT</span>
            <span className="mono">{numericAmount.toLocaleString("fr-FR")} {currency}</span>
          </li>
          <li>
            <span className="muted">Taux appliqué</span>
            <span className="mono">
              {rate ? `${rate.rate.toLocaleString("fr-FR")} XOF` : "…"}{" "}
              {rate && (
                <span className={`badge-line ${rate.source}`} style={{ marginLeft: 6 }}>
                  {rate.source === "live" ? "● live" : "◐ local"}
                </span>
              )}
            </span>
          </li>
          <li>
            <span className="muted">Montant HT en FCFA</span>
            <span className="mono">{preview ? formatXof(preview.htXof) : "…"}</span>
          </li>
          <li>
            <span className="muted">TVA {vatPercent} %</span>
            <span className="mono">{preview ? formatXof(preview.vatXof) : "…"}</span>
          </li>
          <li>
            <span style={{ fontWeight: 600 }}>Total TTC</span>
            <span className="mono" style={{ fontWeight: 700, color: "var(--accent)" }}>
              {preview ? formatXof(preview.ttcXof) : "…"}
            </span>
          </li>
          <li>
            <span className="muted">Échéance (jour ouvré)</span>
            <span className="mono">
              {deadline?.dueDate ?? "…"}
              {deadline?.reason ? <div className="muted" style={{ fontSize: 12 }}>{deadline.reason}</div> : null}
            </span>
          </li>
        </ul>
        <p className="muted" style={{ fontSize: 12, marginTop: 14, marginBottom: 0 }}>
          Le montant FCFA est figé à la création de la facture : une variation ultérieure du taux
          ne modifie pas une facture déjà émise.
        </p>
      </div>
    </div>
  );
}

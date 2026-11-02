"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const CURRENCIES = ["XOF", "XAF", "EUR", "USD", "NGN", "GHS"];
const TIMEZONES = ["Africa/Niamey", "Africa/Dakar", "Africa/Abidjan", "Africa/Lagos", "Africa/Accra", "Europe/Paris"];

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [currency, setCurrency] = useState("XOF");
  const [timezone, setTimezone] = useState("Africa/Niamey");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(name);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { data, error: rpcError } = await supabase.rpc("create_tenant", {
      p_name: name.trim(),
      p_slug: effectiveSlug,
      p_currency_code: currency,
      p_timezone: timezone,
    });

    if (rpcError) {
      setError(
        rpcError.message.includes("confirmed email")
          ? "Votre adresse email doit être confirmée avant de créer une entreprise."
          : rpcError.message,
      );
      setPending(false);
      return;
    }

    const created = Array.isArray(data) ? data[0] : data;
    const tenantId = (created as { id?: string } | null)?.id;
    if (!tenantId) {
      setError("Entreprise créée mais identifiant introuvable. Rechargez la page.");
      setPending(false);
      return;
    }

    await fetch("/api/tenant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenantId }),
    });
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      {error ? <div className="alert error">{error}</div> : null}

      <div className="field">
        <label htmlFor="name">Nom de l’entreprise</label>
        <input
          id="name"
          required
          minLength={2}
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Kanti SARL"
        />
      </div>

      <div className="field">
        <label htmlFor="slug">Identifiant (URL)</label>
        <input
          id="slug"
          required
          value={effectiveSlug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(slugify(event.target.value));
          }}
          placeholder="kanti-sarl"
          className="mono"
        />
        <div className="muted small" style={{ marginTop: 4 }}>
          Lettres minuscules, chiffres et tirets uniquement.
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="currency">Devise</label>
          <select id="currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="timezone">Fuseau horaire</label>
          <select id="timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            {TIMEZONES.map((zone) => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>
        </div>
      </div>

      <button type="submit" className="primary" style={{ width: "100%" }} disabled={pending || name.trim().length < 2}>
        {pending ? "Création…" : "Créer l’entreprise"}
      </button>

      <p className="muted small" style={{ marginTop: 12, marginBottom: 0 }}>
        La création passe par la fonction <code>create_tenant</code> : elle exige un email confirmé,
        valide le slug et installe le rôle Propriétaire avec les 15 permissions.
      </p>
    </form>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface Option {
  variant_id: string;
  name: string;
  sku: string;
  unit: string;
  available: number;
  status: "ok" | "low" | "out";
}

type Draft = { variant_id: string; quantity: string };

const TYPES = [
  { value: "receipt", label: "Réception (entrée)" },
  { value: "issue", label: "Sortie (vente, perte)" },
  { value: "adjustment", label: "Ajustement (motif requis)" },
  { value: "inventory", label: "Inventaire (motif requis)" },
];

export function OperationForm({ options }: { options: Option[] }) {
  const router = useRouter();
  const [type, setType] = useState("receipt");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<Draft[]>([{ variant_id: options[0]?.variant_id ?? "", quantity: "1" }]);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const byId = useMemo(() => new Map(options.map((o) => [o.variant_id, o])), [options]);
  const needsReason = type === "adjustment" || type === "inventory";

  function update(index: number, patch: Partial<Draft>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors([]);
    setSuccess(null);

    const res = await fetch("/api/operations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operation_type: type,
        reference,
        reason,
        lines: lines.map((line) => ({ variant_id: line.variant_id, quantity: Number(line.quantity) })),
      }),
    });
    const json = await res.json();
    setPending(false);

    if (!res.ok) {
      setErrors(json.errors ?? [json.error ?? "Erreur inconnue"]);
      return;
    }
    setSuccess(
      `Opération enregistrée : ${json.operation?.lines?.length ?? lines.length} ligne(s), référence ${
        json.operation?.reference ?? "—"
      }.`,
    );
    setLines([{ variant_id: options[0]?.variant_id ?? "", quantity: "1" }]);
    setReference("");
    setReason("");
    router.refresh();
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Nouvelle opération</h2>

      {errors.length > 0 ? (
        <div className="alert error">
          {errors.map((error) => (
            <div key={error}>• {error}</div>
          ))}
        </div>
      ) : null}
      {success ? <div className="alert ok">{success}</div> : null}

      <div className="form-row">
        <div className="field">
          <label htmlFor="type">Type</label>
          <select id="type" value={type} onChange={(event) => setType(event.target.value)}>
            {TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="reference">Référence</label>
          <input
            id="reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder={type === "issue" ? "VTE-7413" : "REC-606"}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="reason">
          Motif {needsReason ? <span className="crit">(obligatoire)</span> : <span className="muted">(optionnel)</span>}
        </label>
        <input
          id="reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Vente comptoir, casse, réception fournisseur…"
        />
      </div>

      <h3>Lignes</h3>
      {lines.map((line, index) => {
        const selected = byId.get(line.variant_id);
        const qty = Number(line.quantity) || 0;
        const projected = selected ? selected.available + (type === "issue" ? -qty : qty) : 0;
        const insufficient = type === "issue" && selected ? qty > selected.available : false;

        return (
          <div key={index} style={{ marginBottom: 10 }}>
            <div className="form-row" style={{ gridTemplateColumns: "1fr 110px 34px", alignItems: "end" }}>
              <div>
                <label htmlFor={`variant-${index}`}>Produit</label>
                <select
                  id={`variant-${index}`}
                  value={line.variant_id}
                  onChange={(event) => update(index, { variant_id: event.target.value })}
                >
                  {options.map((option) => (
                    <option key={option.variant_id} value={option.variant_id}>
                      {option.sku} — {option.name} ({option.available} {option.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`qty-${index}`}>Quantité</label>
                <input
                  id={`qty-${index}`}
                  inputMode="decimal"
                  value={line.quantity}
                  onChange={(event) => update(index, { quantity: event.target.value })}
                />
              </div>
              <button
                type="button"
                className="small"
                onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                disabled={lines.length === 1}
                aria-label="Retirer la ligne"
              >
                ×
              </button>
            </div>
            {selected ? (
              <div className={`small${insufficient ? " crit" : " muted"}`} style={{ marginTop: 3 }}>
                {insufficient
                  ? `Stock insuffisant : ${selected.available} ${selected.unit} disponible(s).`
                  : `Disponible ${selected.available} ${selected.unit} → après opération ${projected} ${selected.unit}`}
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="row" style={{ marginTop: 6 }}>
        <button
          type="button"
          className="small"
          onClick={() =>
            setLines((current) => [...current, { variant_id: options[0]?.variant_id ?? "", quantity: "1" }])
          }
          disabled={lines.length >= 20}
        >
          + Ajouter une ligne
        </button>
        <span className="spacer" />
        <button type="submit" className="primary" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer l’opération"}
        </button>
      </div>
    </form>
  );
}

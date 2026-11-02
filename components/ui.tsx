import Link from "next/link";
import type { StockRow } from "@/lib/data/types";
import { formatMoney } from "@/lib/money";

const STATUS_LABELS: Record<StockRow["status"], string> = {
  ok: "OK",
  low: "Bas",
  out: "Rupture",
};

export function StatusPill({ status }: { status: StockRow["status"] }) {
  return <span className={`pill ${status}`}>{STATUS_LABELS[status]}</span>;
}

export function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: "good" | "bad" | "warn";
}) {
  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value${tone ? ` ${tone}` : ""}`}>{value}</div>
      {hint ? <div className="kpi-hint">{hint}</div> : null}
    </div>
  );
}

export function Money({ value, currency = "XOF" }: { value: number; currency?: string }) {
  return <span className="mono">{formatMoney(value, currency)}</span>;
}

/** Barre empilée sorties (vert) / entrées (bleu) pour un flux hebdomadaire. */
export function FlowBars({
  data,
}: {
  data: Array<{ week: string; issues: number; receipts: number; operations: number }>;
}) {
  const max = Math.max(...data.map((d) => Math.max(d.issues, d.receipts)), 1);
  return (
    <div>
      {data.map((row) => (
        <div className="bar-row" key={row.week}>
          <span className="muted small mono">{row.week.slice(5)}</span>
          <span className="bar-track">
            <span className="bar-out" style={{ width: `${(row.issues / max) * 50}%` }} title={`Sorties : ${row.issues}`} />
            <span className="bar-in" style={{ width: `${(row.receipts / max) * 50}%` }} title={`Entrées : ${row.receipts}`} />
          </span>
          <span className="right mono small">{row.operations} op.</span>
        </div>
      ))}
      <div className="legend" style={{ marginTop: 8 }}>
        <span><i style={{ background: "var(--accent)" }} />Sorties</span>
        <span><i style={{ background: "var(--info)" }} />Entrées</span>
      </div>
    </div>
  );
}

/** Courbe SVG sans dépendance. */
export function Sparkline({ points, height = 64 }: { points: number[]; height?: number }) {
  if (points.length < 2) return null;
  const width = 300;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const path = points
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / span) * (height - 10) - 5;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }} role="img" aria-label="Évolution">
      <path d={`${path} L${width},${height} L0,${height} Z`} fill="rgba(15,122,82,0.10)" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function Empty({ title, hint, action }: { title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <div style={{ fontSize: 22, marginBottom: 6 }}>◌</div>
      <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{title}</div>
      <div>{hint}</div>
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  );
}

export function LinkButton({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link href={href} className={`btn${primary ? " primary" : ""}`}>
      {children}
    </Link>
  );
}

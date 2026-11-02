/** Petits composants partagés (serveur). */
import Link from "next/link";

export function SourceBadge({
  source,
  note,
}: {
  source: "live" | "fallback";
  note?: string;
}) {
  return (
    <span
      className={`badge-line ${source}`}
      title={note ?? (source === "live" ? "Donnée récupérée en direct" : "Repli local")}
    >
      {source === "live" ? "● live" : "◐ cache local"}
    </span>
  );
}

const LABELS: Record<string, string> = {
  paid: "Payée",
  sent: "Envoyée",
  overdue: "En retard",
  draft: "Brouillon",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{LABELS[status] ?? status}</span>;
}

/** Mini courbe SVG sans dépendance : parfaite pour un taux ou une tendance. */
export function Sparkline({
  points,
  stroke = "var(--accent)",
}: {
  points: number[];
  stroke?: string;
}) {
  if (points.length < 2) return null;
  const width = 320;
  const height = 90;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / span) * (height - 12) - 6;
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const id = `grad-${Math.round(min * 1000)}-${points.length}`;

  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Évolution">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: 36 }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>◌</div>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div className="muted" style={{ fontSize: 13 }}>{hint}</div>
    </div>
  );
}

export function CtaLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="btn primary">
      {children}
    </Link>
  );
}

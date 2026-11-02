import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card" style={{ textAlign: "center", padding: 48 }}>
      <div style={{ fontSize: 34, marginBottom: 8 }}>404</div>
      <h1>Introuvable</h1>
      <p className="sub" style={{ marginBottom: 20 }}>
        Cette facture ou cette page n&apos;existe pas.
      </p>
      <Link href="/" className="btn primary">Retour au tableau de bord</Link>
    </div>
  );
}

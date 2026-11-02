import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { getDataSource } from "@/lib/data/repository";

export const metadata: Metadata = {
  title: "Kanti — gestion de stock",
  description:
    "Stock, catalogue et équipe pour les commerces d’Afrique de l’Ouest : dépôts multiples, valorisation en FCFA, points de commande et journal d’opérations auditable.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const source = getDataSource();
  const [tenant, rows] = await Promise.all([source.getTenant(), source.getRows()]);
  const alerts = rows.filter((row) => row.status !== "ok").length;
  const demo = source.kind === "demo";

  return (
    <html lang="fr">
      <body>
        <div className="shell">
          <Sidebar tenantName={tenant.name} slug={tenant.slug} alerts={alerts} />
          <main className="main">
            {demo ? (
              <div className="mode-bar">
                <strong>Mode démo</strong>
                <span>
                  données réelles du {`2026-11-02`} figées dans un snapshot. Renseigne{" "}
                  <code>NEXT_PUBLIC_SUPABASE_URL</code> + <code>SUPABASE_SERVICE_ROLE_KEY</code> pour
                  passer en live.
                </span>
              </div>
            ) : null}
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

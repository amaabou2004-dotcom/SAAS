import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Sahel Desk — pilotage SaaS",
  description:
    "Tableau de bord SaaS pour facturer en FCFA : taux BCEAO/BCE, jours fériés du Niger, météo et suivi des impayés.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <div className="shell">
          <Sidebar />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}

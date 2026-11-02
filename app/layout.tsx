import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kanti — gestion de stock",
  description:
    "Stock, catalogue et équipe pour les commerces d’Afrique de l’Ouest : dépôts multiples, valorisation en FCFA, points de commande et journal d’opérations auditable.",
};

/** Racine minimale : le shell applicatif vit dans app/(app)/layout.tsx. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}

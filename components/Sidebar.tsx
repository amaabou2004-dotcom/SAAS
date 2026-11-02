"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Tableau de bord", icon: "◱" },
  { href: "/invoices", label: "Factures", icon: "▤" },
  { href: "/settings", label: "Intégrations", icon: "⚙" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="dot" />
        Sahel Desk
      </div>
      {LINKS.map((link) => {
        const active =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link${active ? " active" : ""}`}
          >
            <span aria-hidden>{link.icon}</span>
            {link.label}
          </Link>
        );
      })}
      <div className="spacer" />
      <div className="muted" style={{ fontSize: 11.5, padding: "0 10px" }}>
        v0.1 · données de démo
        <br />
        stockage en mémoire
      </div>
    </aside>
  );
}

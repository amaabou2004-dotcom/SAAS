"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  {
    group: "Pilotage",
    links: [
      { href: "/", label: "Tableau de bord", ico: "◧" },
      { href: "/stock", label: "Stock", ico: "▦" },
      { href: "/operations", label: "Opérations", ico: "⇅" },
    ],
  },
  {
    group: "Référentiel",
    links: [
      { href: "/catalogue", label: "Catalogue", ico: "▤" },
      { href: "/fournisseurs", label: "Fournisseurs", ico: "⛭" },
    ],
  },
  {
    group: "Administration",
    links: [
      { href: "/equipe", label: "Équipe & rôles", ico: "◍" },
      { href: "/settings", label: "Intégrations", ico: "⚙" },
    ],
  },
];

export function Sidebar({
  tenantName,
  slug,
  alerts,
}: {
  tenantName: string;
  slug: string;
  alerts: number;
}) {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">{tenantName.slice(0, 2).toUpperCase()}</div>
        <div>
          <div className="name">{tenantName}</div>
          <div className="tenant">{slug}</div>
        </div>
      </div>

      {NAV.map((section) => (
        <div key={section.group}>
          <div className="nav-group">{section.group}</div>
          {section.links.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} className={`nav-link${active ? " active" : ""}`}>
                <span className="ico" aria-hidden>{link.ico}</span>
                {link.label}
                {link.href === "/stock" && alerts > 0 ? (
                  <span className="nav-count">{alerts}</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
  );
}

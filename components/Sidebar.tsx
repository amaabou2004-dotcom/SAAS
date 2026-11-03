"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { TenantOption } from "@/lib/data/tenancy";

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
  mode,
  email,
  canSwitch,
  activeTenantId,
  tenants,
}: {
  tenantName: string;
  slug: string;
  alerts: number;
  mode: "demo" | "live";
  email: string | null;
  canSwitch: boolean;
  activeTenantId: string | null;
  tenants: TenantOption[];
}) {
  const pathname = usePathname();
  const [switching, setSwitching] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  async function switchTenant(tenantId: string) {
    setPending(tenantId);
    const res = await fetch("/api/tenant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenantId }),
    });
    if (res.ok) {
      window.location.assign("/");
      return;
    }
    setPending(null);
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">{tenantName.slice(0, 2).toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          <div className="name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {tenantName}
          </div>
          <div className="tenant">{slug}</div>
        </div>
      </div>

      {canSwitch ? (
        <div style={{ padding: "0 8px 8px" }}>
          <button className="small" style={{ width: "100%" }} onClick={() => setSwitching((v) => !v)}>
            {switching ? "Annuler" : "Changer d’entreprise"}
          </button>
          {switching ? (
            <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
              {tenants.map((tenant) => (
                <button
                  key={tenant.id}
                  className="small"
                  disabled={pending !== null || tenant.id === activeTenantId}
                  onClick={() => switchTenant(tenant.id)}
                  style={{ textAlign: "left" }}
                >
                  {tenant.name}
                  {tenant.id === activeTenantId ? " ✓" : ""}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {NAV.map((section) => (
        <div key={section.group}>
          <div className="nav-group">{section.group}</div>
          {section.links.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} className={`nav-link${active ? " active" : ""}`}>
                <span className="ico" aria-hidden>{link.ico}</span>
                {link.label}
                {link.href === "/stock" && alerts > 0 ? <span className="nav-count">{alerts}</span> : null}
              </Link>
            );
          })}
        </div>
      ))}

      <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <div className="row" style={{ padding: "0 8px", gap: 6 }}>
          <span className={`pill ${mode === "live" ? "ok" : "neutral"}`}>
            {mode === "live" ? "● live" : "◐ démo"}
          </span>
        </div>
        {email ? (
          <>
            <div className="muted small" style={{ padding: "8px 8px 4px", overflow: "hidden", textOverflow: "ellipsis" }}>
              {email}
            </div>
            <form action="/auth/signout" method="post">
              <button type="submit" className="small" style={{ width: "100%" }}>
                Se déconnecter
              </button>
            </form>
          </>
        ) : (
          <Link href="/login" className="nav-link" style={{ marginTop: 6 }}>
            <span className="ico" aria-hidden>→</span>
            Se connecter
          </Link>
        )}
      </div>
    </aside>
  );
}

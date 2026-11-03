"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TenantOption } from "@/lib/data/tenancy";

export function SelectTenantForm({ tenants }: { tenants: TenantOption[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function choose(tenantId: string) {
    setPending(tenantId);
    const res = await fetch("/api/tenant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenantId }),
    });
    if (!res.ok) {
      setPending(null);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {tenants.map((tenant) => (
        <button
          key={tenant.id}
          type="button"
          onClick={() => choose(tenant.id)}
          disabled={pending !== null}
          style={{ textAlign: "left", padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}
        >
          <span
            style={{
              width: 34, height: 34, borderRadius: 9, background: "var(--accent-soft)",
              color: "var(--accent)", display: "grid", placeItems: "center", fontWeight: 700, flexShrink: 0,
            }}
          >
            {tenant.name.slice(0, 2).toUpperCase()}
          </span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontWeight: 600 }}>{tenant.name}</span>
            <span className="muted small">
              {tenant.slug} · {tenant.role_name}
            </span>
          </span>
          <span className="muted">{pending === tenant.id ? "…" : "→"}</span>
        </button>
      ))}
    </div>
  );
}

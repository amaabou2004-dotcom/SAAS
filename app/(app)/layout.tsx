import { cookies } from "next/headers";
import { Sidebar } from "@/components/Sidebar";
import { getAppContext } from "@/lib/data/server-source";
import { listMyTenants, TENANT_COOKIE } from "@/lib/data/tenancy";
import { getSession } from "@/lib/supabase/server";

/** Le shell dépend de la session et du tenant : jamais de cache statique. */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { source, mode, email } = await getAppContext();
  const [tenant, rows] = await Promise.all([source.getTenant(), source.getRows()]);
  const alerts = rows.filter((row) => row.status !== "ok").length;

  const session = await getSession();
  const tenants = session ? await listMyTenants() : [];
  const cookieStore = await cookies();

  return (
    <div className="shell">
      <Sidebar
        tenantName={tenant.name}
        slug={tenant.slug}
        alerts={alerts}
        mode={mode}
        email={email}
        canSwitch={tenants.length > 1}
        activeTenantId={cookieStore.get(TENANT_COOKIE)?.value ?? null}
        tenants={tenants}
      />
      <main className="main">
        {mode === "demo" ? (
          <div className="mode-bar">
            <strong>{session ? "Mode démo" : "Non connecté — mode démo"}</strong>
            <span>
              données réelles du 2026-11-02 figées dans un snapshot.{" "}
              {session
                ? "Sélectionnez une entreprise pour passer en live."
                : "Connectez-vous pour piloter votre base."}
            </span>
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}

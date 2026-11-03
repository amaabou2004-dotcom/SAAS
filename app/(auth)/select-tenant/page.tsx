import Link from "next/link";
import { redirect } from "next/navigation";
import { listMyTenants } from "@/lib/data/tenancy";
import { getSession } from "@/lib/supabase/server";
import { SelectTenantForm } from "./SelectTenantForm";

export const dynamic = "force-dynamic";

export default async function SelectTenantPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const tenants = await listMyTenants();
  if (tenants.length === 1) redirect("/");

  return (
    <>
      <div className="auth-card">
        <h1 style={{ marginBottom: 4 }}>Choisir l’entreprise</h1>
        <p className="sub" style={{ marginBottom: 18 }}>
          Connecté en tant que <strong>{session.email}</strong>
        </p>

        {tenants.length === 0 ? (
          <>
            <div className="alert warn">
              Aucune entreprise n’est rattachée à ce compte. Créez-en une pour commencer.
            </div>
            <Link href="/onboarding" className="btn primary" style={{ display: "block", textAlign: "center" }}>
              Créer mon entreprise
            </Link>
          </>
        ) : (
          <SelectTenantForm tenants={tenants} />
        )}

        <form action="/auth/signout" method="post" style={{ marginTop: 16 }}>
          <button type="submit" style={{ width: "100%" }}>
            Se déconnecter
          </button>
        </form>
      </div>
    </>
  );
}

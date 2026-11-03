import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listMyTenants, TENANT_COOKIE } from "@/lib/data/tenancy";

/**
 * Fixe le tenant actif. On revérifie l'adhésion avant d'écrire le cookie :
 * un identifiant inventé ne doit jamais devenir un tenant « actif ».
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { tenant_id?: string };
  const tenantId = String(body.tenant_id ?? "");
  if (!tenantId) return NextResponse.json({ error: "tenant_id requis" }, { status: 422 });

  const tenants = await listMyTenants();
  const allowed = tenants.find((tenant) => tenant.id === tenantId);
  if (!allowed) {
    return NextResponse.json({ error: "Entreprise non autorisée" }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.set(TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ tenant: allowed });
}

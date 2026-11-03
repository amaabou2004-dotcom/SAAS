import { cookies } from "next/headers";
import { createSupabaseServerClient, getSession } from "@/lib/supabase/server";
import { pickActiveTenantId } from "@/lib/data/tenancy-helpers";

export const TENANT_COOKIE = "kanti_tenant";

export interface TenantOption {
  id: string;
  name: string;
  slug: string;
  role_name: string;
}

/**
 * Entreprises auxquelles l'utilisateur connecté appartient.
 * `memberships` est protégée par RLS (`is_tenant_member`), donc la requête ne
 * peut renvoyer que des lignes légitimes.
 */
export async function listMyTenants(): Promise<TenantOption[]> {
  const session = await getSession();
  if (!session) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("tenant_id, status, roles(name), tenants(id, name, slug, status)")
    .eq("user_id", session.userId)
    .eq("status", "active");

  if (error || !data) return [];

  return data
    .map((row) => {
      const tenant = row.tenants as unknown as
        | { id: string; name: string; slug: string; status: string }
        | null;
      const role = row.roles as unknown as { name: string } | null;
      if (!tenant || tenant.status !== "active") return null;
      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        role_name: role?.name ?? "—",
      } satisfies TenantOption;
    })
    .filter((item): item is TenantOption => item !== null);
}

/** Le cookie de tenant n'est accepté que s'il correspond à une adhésion réelle. */
export async function getActiveTenantId(): Promise<string | null> {
  const cookieStore = await cookies();
  const tenants = await listMyTenants();
  return pickActiveTenantId(tenants, cookieStore.get(TENANT_COOKIE)?.value);
}

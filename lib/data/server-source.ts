import { getSession } from "@/lib/supabase/server";
import { getActiveTenantId } from "@/lib/data/tenancy";
import { getDataSource, type DataSource } from "./repository";

export interface AppContext {
  source: DataSource;
  mode: "demo" | "live";
  email: string | null;
  tenantId: string | null;
}

/**
 * Point d'entrée unique pour les Server Components : on résout la session, puis
 * le tenant actif (cookie validé contre les adhésions), puis la source de
 * données correspondante. Pas de session → mode démo.
 */
export async function getAppContext(): Promise<AppContext> {
  const session = await getSession();
  if (!session) {
    return { source: getDataSource(null), mode: "demo", email: null, tenantId: null };
  }

  const tenantId = await getActiveTenantId();
  const live = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return {
    source: getDataSource({ accessToken: session.accessToken, tenantId }),
    mode: live && tenantId ? "live" : "demo",
    email: session.email,
    tenantId,
  };
}

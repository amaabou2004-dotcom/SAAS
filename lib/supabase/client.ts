import { createBrowserClient } from "@supabase/ssr";

/** Client navigateur (auth + OAuth). Aucune clé service ici. */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase non configuré côté navigateur");
  return createBrowserClient(url, anonKey);
}

export const isSupabaseEnabled = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

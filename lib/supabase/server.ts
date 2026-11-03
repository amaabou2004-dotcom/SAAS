import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Client Supabase côté serveur : la session vit dans les cookies (httpOnly,
 * rafraîchie par le middleware). On s'en sert pour l'auth ET pour interroger la
 * base avec le JWT de l'utilisateur, afin que la RLS s'applique réellement.
 */
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase non configuré");

  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list) {
        try {
          for (const { name, value, options } of list) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appelé depuis un Server Component : le middleware rafraîchit déjà.
        }
      },
    },
  });
}

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export interface SessionInfo {
  userId: string;
  email: string;
  accessToken: string;
}

/** Session courante, ou `null` en mode démo / visiteur non connecté. */
export async function getSession(): Promise<SessionInfo | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session?.user) return null;
    return {
      userId: session.user.id,
      email: session.user.email ?? "",
      accessToken: session.access_token,
    };
  } catch {
    return null;
  }
}

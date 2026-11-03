import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Trois responsabilités :
 *  1. rafraîchir le cookie de session Supabase à chaque requête ;
 *  2. en mode configuré, forcer le passage par /login puis /select-tenant ;
 *  3. en mode démo (pas de variables d'env), ne rien bloquer — la préview doit
 *     rester entièrement navigable sans configuration.
 */
export default async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(list) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  // Supabase peut être injoignable (réseau, panne) : on dégrade en visiteur
  // non connecté plutôt que de casser toutes les routes.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user ?? null;
  } catch {
    user = null;
  }

  const { pathname, search } = request.nextUrl;
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/health") ||
    pathname === "/favicon.ico";

  if (!user && !isPublic) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(redirect);
  }

  if (user && pathname.startsWith("/login")) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  // Tenant actif : cookie posé par /select-tenant, sinon on redirige.
  const tenant = request.cookies.get("kanti_tenant")?.value;
  const needsTenant =
    user &&
    !tenant &&
    !isPublic &&
    !pathname.startsWith("/select-tenant") &&
    !pathname.startsWith("/onboarding");

  if (needsTenant) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/select-tenant";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

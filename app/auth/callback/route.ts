import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Échange le code OAuth / magic link contre une session en cookies. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/";
  const origin = request.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=code_absent`);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "callback_failed";
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}

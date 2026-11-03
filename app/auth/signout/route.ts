import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // Rien à faire : on nettoie les cookies applicatifs de toute façon.
  }
  const response = NextResponse.redirect(`${request.nextUrl.origin}/login`, { status: 303 });
  response.cookies.delete("kanti_tenant");
  return response;
}

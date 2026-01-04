import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";

  if (!code) {
    // No code = something went wrong
    return NextResponse.redirect(
      new URL("/auth/login?error=missing_code", requestUrl.origin)
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("exchangeCodeForSession error", error.message);
    return NextResponse.redirect(
      new URL("/auth/login?error=oauth_failed", requestUrl.origin)
    );
  }

  // At this point auth cookies are set and SSR can see the user
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}


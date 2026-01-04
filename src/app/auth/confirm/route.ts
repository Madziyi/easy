import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const _next = searchParams.get("next");
  const next = _next && _next.startsWith("/") ? _next : "/";

  if (token_hash && type) {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      // Successfully confirmed & logged in → go to intended page
      redirect(next);
    } else {
      console.error("verifyOtp error", error.message);
      redirect(`/auth/login?error=${encodeURIComponent("email_confirm_failed")}`);
    }
  }

  redirect(`/auth/login?error=${encodeURIComponent("invalid_confirm_link")}`);
}



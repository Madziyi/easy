'use server';

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function loginWithGoogle(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const headersList = await headers();
  const origin =
    headersList.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const rawNext = formData.get("next");
  const next =
    typeof rawNext === "string" && rawNext.startsWith("/") ? rawNext : "/";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data?.url) {
    console.error("Google OAuth error", error?.message);
    redirect("/auth/login?error=google_oauth_failed");
  }

  // This sends the user off to Google → Supabase → back to /auth/callback
  redirect(data.url);
}

export async function loginWithEmailPassword(formData: FormData) {
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");
  const rawNext = formData.get("next");

  const email =
    typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";
  const next =
    typeof rawNext === "string" && rawNext.startsWith("/") ? rawNext : "/";

  if (!email || !password) {
    redirect("/auth/login?error=missing_fields");
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("signInWithPassword error", error.message);
    redirect("/auth/login?error=invalid_credentials");
  }

  redirect(next);
}


'use server';

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signUpWithEmailPassword(formData: FormData) {
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");
  const rawConfirm = formData.get("confirmPassword");
  const rawNext = formData.get("next");

  const email =
    typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";
  const confirmPassword =
    typeof rawConfirm === "string" ? rawConfirm : "";
  const next =
    typeof rawNext === "string" && rawNext.startsWith("/") ? rawNext : "/";

  if (!email || !password || !confirmPassword) {
    redirect("/auth/signup?error=missing_fields");
  }

  if (password !== confirmPassword) {
    redirect("/auth/signup?error=password_mismatch");
  }

  if (password.length < 8) {
    redirect("/auth/signup?error=weak_password");
  }

  const supabase = await createSupabaseServerClient();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    console.error("NEXT_PUBLIC_APP_URL is not set");
    redirect("/auth/signup?error=server_config");
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // This becomes {{ .RedirectTo }} in the email template
      emailRedirectTo: `${appUrl}/auth/confirm?next=${encodeURIComponent(
        next
      )}`,
    },
  });

  if (error) {
    console.error("signUp error", error.message);
    redirect("/auth/signup?error=signup_failed");
  }

  // With email confirmation required, user must click the email link.
  redirect("/auth/signup?success=check_email");
}



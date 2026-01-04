import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    // Optional: log error, but don’t crash SSR
    console.error("getCurrentUser error", error.message);
  }

  return user; // might be null
}


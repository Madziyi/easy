import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value ?? null;
        },
        set(name, value, options) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // In pure server components, cookies() is read-only; ignore errors there.
          }
        },
        remove(name, options) {
          try {
            cookieStore.set(name, "", { ...options, maxAge: 0 });
          } catch {
            // In pure server components, cookies() is read-only; ignore errors there.
          }
        },
      },
    }
  );
}


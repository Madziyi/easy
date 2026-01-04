import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

// Singleton client for generating public URLs from public buckets
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

export function getPublicImageUrl(
  bucket: string,
  storagePath: string | null | undefined
): string | null {
  if (!storagePath) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return data?.publicUrl ?? null;
}



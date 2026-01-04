import { createSupabaseServerClient } from "@/lib/supabase/server";
import SearchPageClient from "./SearchPageClient";

type SearchParams = {
  q?: string;
  city?: string;
  cuisines?: string | string[];
  features?: string | string[];
};

type CuisineRow = {
  id: number;
  slug: string;
  name: string;
  category: string | null;
  sort_order: number;
};

type FeatureRow = {
  id: number;
  slug: string;
  name: string;
  category: string | null;
  icon_key: string | null;
  sort_order: number;
};

export default async function SearchPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const searchParams = await props.searchParams;
  const initialQuery = searchParams.q ?? "";
  const initialCity = searchParams.city ?? "";

  const supabase = await createSupabaseServerClient();

  const [{ data: cuisines }, { data: features }] = await Promise.all([
    supabase
      .from("cuisines")
      .select("id, slug, name, category, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }) as unknown as {
      data: CuisineRow[] | null;
    },
    supabase
      .from("features")
      .select("id, slug, name, category, icon_key, sort_order")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }) as unknown as {
      data: FeatureRow[] | null;
    },
  ]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
      <SearchPageClient
        initialQuery={initialQuery}
        initialCity={initialCity}
        cuisines={cuisines ?? []}
        features={features ?? []}
      />
    </main>
  );
}


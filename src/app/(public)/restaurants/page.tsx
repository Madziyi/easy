import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RestaurantRow = {
  id: string;
  slug: string;
  name: string;
  city: string;
  description: string | null;
  currency_code: string;
};

export const revalidate = 60; // SSG with periodic revalidation

export default async function RestaurantsPage() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("restaurants")
    .select("id, slug, name, city, description, currency_code")
    .eq("status", "PUBLISHED")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error loading restaurants:", error);
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold mb-4">Restaurants</h1>
        <p className="text-sm text-red-600">
          Something went wrong loading restaurants.
        </p>
      </main>
    );
  }

  const restaurants: RestaurantRow[] = data ?? [];

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-4">Restaurants</h1>
      <p className="text-sm text-neutral-600 mb-6">
        Browse published restaurants on EasyEats.
      </p>

      {restaurants.length === 0 ? (
        <p className="text-sm text-neutral-600">No restaurants yet.</p>
      ) : (
        <ul className="space-y-4">
          {restaurants.map((r) => (
            <li
              key={r.id}
              className="border border-neutral-200 rounded-lg p-4 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    <Link href={`/restaurants/${r.slug}`}>{r.name}</Link>
                  </h2>
                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                    {r.city}
                  </p>
                  {r.description && (
                    <p className="mt-2 text-sm text-neutral-700 line-clamp-2">
                      {r.description}
                    </p>
                  )}
                </div>
                <span className="text-xs text-neutral-500">
                  {r.currency_code}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}



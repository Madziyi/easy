import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveRestaurantProfile } from "./actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
};

type RestaurantRow = {
  id: string;
  name: string;
  city: string | null;
  description: string | null;
  phone_number: string | null;
  whatsapp_number: string | null;
  contact_email: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  google_url: string | null;
  tripadvisor_url: string | null;
};

type LocationRow = {
  address_line1: string | null;
  address_line2: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string | null;
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

type RestaurantCuisineRow = {
  cuisine_id: number;
};

type RestaurantFeatureRow = {
  feature_id: number;
};

export default async function OwnerRestaurantProfilePage({
  params,
  searchParams,
}: PageProps) {
  const [{ id: restaurantId }, sp] = await Promise.all([params, searchParams]);

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?next=/owner/restaurants/${restaurantId}/profile`);
  }

  const supabase = await createSupabaseServerClient();

  const { data: membership } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", user.id)
    .in("role", ["OWNER", "MANAGER"])
    .maybeSingle();

  if (!membership) {
    redirect("/owner");
  }

  const [
    { data: restaurant },
    { data: location },
    { data: cuisines },
    { data: features },
    { data: restaurantCuisineRows },
    { data: restaurantFeatureRows },
  ] = await Promise.all([
    supabase
      .from("restaurants")
      .select(
        `
        id,
        name,
        city,
        description,
        phone_number,
        whatsapp_number,
        contact_email,
        website_url,
        facebook_url,
        instagram_url,
        tiktok_url,
        google_url,
        tripadvisor_url
      `
      )
      .eq("id", restaurantId)
      .maybeSingle<RestaurantRow>(),
    supabase
      .from("restaurant_locations")
      .select(
        `
        address_line1,
        address_line2,
        region,
        postal_code,
        country,
        latitude,
        longitude,
        google_maps_url
      `
      )
      .eq("restaurant_id", restaurantId)
      .maybeSingle<LocationRow>(),
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
    supabase
      .from("restaurant_cuisines")
      .select("cuisine_id")
      .eq("restaurant_id", restaurantId) as unknown as {
      data: RestaurantCuisineRow[] | null;
    },
    supabase
      .from("restaurant_features")
      .select("feature_id")
      .eq("restaurant_id", restaurantId) as unknown as {
      data: RestaurantFeatureRow[] | null;
    },
  ]);

  if (!restaurant) {
    redirect("/owner");
  }

  const savedFlag = sp.saved === "1";
  const errorKey = sp.error;
  const errorMessage =
    errorKey === "invalid_coordinates"
      ? "Latitude and longitude must be valid numbers."
      : errorKey === "save_failed"
      ? "Could not save your changes. Please try again."
      : null;

  const loc = location ?? ({} as LocationRow);
  const allCuisines = cuisines ?? [];
  const allFeatures = features ?? [];

  const selectedCuisineIds = new Set(
    (restaurantCuisineRows ?? []).map((r) => r.cuisine_id)
  );
  const selectedFeatureIds = new Set(
    (restaurantFeatureRows ?? []).map((r) => r.feature_id)
  );

  const featuresByCategory = allFeatures.reduce<Record<string, FeatureRow[]>>(
    (acc, f) => {
      const key = f.category || "other";
      if (!acc[key]) acc[key] = [];
      acc[key].push(f);
      return acc;
    },
    {}
  );

  return (
    <main className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-xl font-semibold">Profile – {restaurant.name}</h1>
        <p className="text-sm text-neutral-600">
          Update your public details, contact info, socials, and location.
        </p>
      </section>

      {savedFlag && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Changes saved.
        </div>
      )}
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      <form
        action={saveRestaurantProfile}
        className="space-y-6 border border-neutral-200 rounded-2xl bg-white p-4"
      >
        <input type="hidden" name="restaurantId" value={restaurant.id} />

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Basics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-neutral-800">
                Name
              </label>
              <input
                type="text"
                name="name"
                defaultValue={restaurant.name}
                required
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-neutral-800">
                City
              </label>
              <input
                type="text"
                name="city"
                defaultValue={restaurant.city ?? ""}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-neutral-800">
              Short description
            </label>
            <textarea
              name="description"
              defaultValue={restaurant.description ?? ""}
              rows={4}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
              placeholder="Describe your concept, cuisine, and atmosphere."
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Contact & Socials
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-neutral-800">
                Phone
              </label>
              <input
                type="text"
                name="phone_number"
                defaultValue={restaurant.phone_number ?? ""}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
                placeholder="+263…"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-neutral-800">
                WhatsApp number
              </label>
              <input
                type="text"
                name="whatsapp_number"
                defaultValue={restaurant.whatsapp_number ?? ""}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
                placeholder="+263…"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-neutral-800">
                Contact email
              </label>
              <input
                type="email"
                name="contact_email"
                defaultValue={restaurant.contact_email ?? ""}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
                placeholder="bookings@example.com"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-neutral-800">
                Website
              </label>
              <input
                type="url"
                name="website_url"
                defaultValue={restaurant.website_url ?? ""}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
                placeholder="https://your-restaurant.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-neutral-800">
                Facebook URL
              </label>
              <input
                type="url"
                name="facebook_url"
                defaultValue={restaurant.facebook_url ?? ""}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
                placeholder="https://facebook.com/yourpage"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-neutral-800">
                Instagram URL
              </label>
              <input
                type="url"
                name="instagram_url"
                defaultValue={restaurant.instagram_url ?? ""}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
                placeholder="https://instagram.com/yourhandle"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-neutral-800">
                TikTok URL
              </label>
              <input
                type="url"
                name="tiktok_url"
                defaultValue={restaurant.tiktok_url ?? ""}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
                placeholder="https://tiktok.com/@yourhandle"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-neutral-800">
                Google Business Profile URL
              </label>
              <input
                type="url"
                name="google_url"
                defaultValue={restaurant.google_url ?? ""}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
                placeholder="https://maps.google.com/…"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-neutral-800">
                Tripadvisor URL
              </label>
              <input
                type="url"
                name="tripadvisor_url"
                defaultValue={restaurant.tripadvisor_url ?? ""}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
                placeholder="https://tripadvisor.com/…"
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Location
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-neutral-800">
                Address line 1
              </label>
              <input
                type="text"
                name="address_line1"
                defaultValue={loc.address_line1 ?? ""}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-neutral-800">
                Address line 2
              </label>
              <input
                type="text"
                name="address_line2"
                defaultValue={loc.address_line2 ?? ""}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-neutral-800">
                Region / Province
              </label>
              <input
                type="text"
                name="region"
                defaultValue={loc.region ?? ""}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-neutral-800">
                Postal code
              </label>
              <input
                type="text"
                name="postal_code"
                defaultValue={loc.postal_code ?? ""}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-neutral-800">
                Country
              </label>
              <input
                type="text"
                name="country"
                defaultValue={loc.country ?? ""}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-neutral-800">
                Google Maps link (optional)
              </label>
              <input
                type="url"
                name="google_maps_url"
                defaultValue={loc.google_maps_url ?? ""}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
                placeholder="https://maps.google.com/…"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-neutral-800">
                Latitude (optional)
              </label>
              <input
                type="number"
                step="any"
                name="latitude"
                defaultValue={loc.latitude != null ? String(loc.latitude) : ""}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-neutral-800">
                Longitude (optional)
              </label>
              <input
                type="number"
                step="any"
                name="longitude"
                defaultValue={loc.longitude != null ? String(loc.longitude) : ""}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
              />
            </div>
          </div>
        </section>

        {/* Cuisines */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Cuisines
          </h2>
          <p className="text-xs text-neutral-600">
            Choose the main types of cuisine you serve. These show as chips on your
            public profile and power filters.
          </p>
          <div className="flex flex-wrap gap-2">
            {allCuisines.length === 0 ? (
              <p className="text-xs text-neutral-500">
                No cuisines configured yet. An admin can add them from the back office.
              </p>
            ) : (
              allCuisines.map((cuisine) => (
                <label
                  key={cuisine.id}
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-neutral-50 px-3 py-1 text-xs text-neutral-800 hover:border-[#e81111] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    name="cuisine_ids"
                    value={cuisine.id}
                    defaultChecked={selectedCuisineIds.has(cuisine.id)}
                    className="h-3 w-3 rounded border-neutral-300 text-[#e81111] focus:ring-[#e81111]"
                  />
                  <span>{cuisine.name}</span>
                </label>
              ))
            )}
          </div>
        </section>

        {/* Features & amenities */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Features & amenities
          </h2>
          <p className="text-xs text-neutral-600">
            Highlight dietary options, amenities, services, and atmosphere. These appear in a
            dedicated section on your profile and help diners find the right spot.
          </p>

          <div className="space-y-4">
            {Object.keys(featuresByCategory).length === 0 ? (
              <p className="text-xs text-neutral-500">
                No features configured yet. An admin can add them from the back office.
              </p>
            ) : (
              Object.entries(featuresByCategory).map(
                ([categoryKey, featureList]) => (
                  <div key={categoryKey} className="space-y-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                      {categoryKey.replace(/-/g, " ")}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {featureList.map((feature) => (
                        <label
                          key={feature.id}
                          className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-neutral-50 px-3 py-1 text-xs text-neutral-800 hover:border-[#e81111] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            name="feature_ids"
                            value={feature.id}
                            defaultChecked={selectedFeatureIds.has(feature.id)}
                            className="h-3 w-3 rounded border-neutral-300 text-[#e81111] focus:ring-[#e81111]"
                          />
                          <span>{feature.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              )
            )}
          </div>
        </section>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="rounded-full bg-[#e81111] px-4 py-2 text-sm font-medium text-white hover:bg-red-700 active:bg-red-800 transition"
          >
            Save changes
          </button>
          <a
            href={`/owner/restaurants/${restaurant.id}`}
            className="text-xs text-neutral-600 hover:underline"
          >
            Back to restaurant dashboard
          </a>
        </div>
      </form>
    </main>
  );
}



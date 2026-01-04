import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicImageUrl } from "@/lib/storage";
import { computeCombinedRating } from "@/lib/ratings";
import { MenuItemImagePreview } from "@/components/MenuItemImagePreview";

type Restaurant = {
  id: string;
  slug: string;
  name: string;
  city: string;
  description: string | null;
  phone_number: string | null;
  whatsapp_number: string | null;
  currency_code: string;
  google_rating: number | null;
  google_review_count: number;
  google_url: string | null;
  tripadvisor_rating: number | null;
  tripadvisor_review_count: number;
  tripadvisor_url: string | null;
};

type Location = {
  address_line1: string | null;
  address_line2: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string | null;
};

type MenuItem = {
  id: string;
  section_name: string | null;
  name: string;
  description: string | null;
  price_cents: number;
  currency_code: string | null;
  image_storage_path: string | null;
};

type MenuItemWithImage = MenuItem & { imageUrl: string | null };

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

type GalleryImage = {
  id: string;
  storage_path: string;
  image_type: "GALLERY" | "INTERIOR" | "EXTERIOR" | "FOOD" | "DRINK";
  position: number;
};

type ReviewRow = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  app_users: { display_name: string | null } | null;
  review_replies?: {
    id: string;
    reply_body: string;
    replied_at: string;
  }[];
};

type ReviewImageRow = {
  id: string;
  review_id: string;
  storage_path: string;
};

function formatPrice(priceCents: number, currency: string) {
  const amount = priceCents / 100;
  return new Intl.NumberFormat("en-ZW", {
    style: "currency",
    currency,
  }).format(amount);
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 60;

export default async function RestaurantDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: restaurant, error: restErr } = await supabase
    .from("restaurants")
    .select(
      `
      id,
      slug,
      name,
      city,
      description,
      phone_number,
      whatsapp_number,
      currency_code,
      google_rating,
      google_review_count,
      google_url,
      tripadvisor_rating,
      tripadvisor_review_count,
      tripadvisor_url
    `
    )
    .eq("slug", slug)
    .eq("status", "PUBLISHED")
    .maybeSingle<Restaurant>();

  if (restErr) {
    console.error("Error loading restaurant:", restErr?.message);
  }

  if (!restaurant) {
    return notFound();
  }

  const { data: location } = await supabase
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
    .eq("restaurant_id", restaurant.id)
    .maybeSingle<Location>();

  const mapsUrl =
    location?.google_maps_url ||
    (location?.latitude != null && location?.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
      : null);

  const [
    { data: restaurantCuisineRows },
    { data: restaurantFeatureRows },
    { data: defaultMenus },
  ] = await Promise.all([
    supabase
      .from("restaurant_cuisines")
      .select("cuisine_id")
      .eq("restaurant_id", restaurant.id),
    supabase
      .from("restaurant_features")
      .select("feature_id")
      .eq("restaurant_id", restaurant.id),
    supabase
    .from("menus")
    .select("id")
    .eq("restaurant_id", restaurant.id)
      .eq("is_default", true)
      .limit(1),
  ]);

  const defaultMenuId = defaultMenus?.[0]?.id as string | undefined;

  let menuItems: MenuItemWithImage[] = [];
  if (defaultMenuId) {
    const { data: items } = await supabase
      .from("menu_items")
      .select(
        `
        id,
        section_name,
        name,
        description,
        price_cents,
        currency_code,
        image_storage_path
      `
      )
      .eq("menu_id", defaultMenuId)
      .order("section_name", { ascending: true })
      .order("name", { ascending: true });

    menuItems = ((items ?? []) as MenuItem[]).map((item) => ({
      ...item,
      imageUrl: item.image_storage_path
        ? getPublicImageUrl("restaurants", item.image_storage_path)
        : null,
    })) as MenuItemWithImage[];
  }

  const effectiveCurrency = restaurant.currency_code || "USD";

  const itemsBySection = menuItems.reduce<
    Record<string, MenuItemWithImage[]>
  >(
    (acc, item) => {
      const key = item.section_name || "Menu";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {}
  );

  const { data: galleryRows } = await supabase
    .from("restaurant_images")
    .select(
      `
      id,
      storage_path,
      image_type,
      position
    `
    )
    .eq("restaurant_id", restaurant.id)
    .order("position", { ascending: true })
    .limit(15);

  const gallery =
    ((galleryRows as GalleryImage[] | null) ?? []).map((img) => ({
      id: img.id,
      url: getPublicImageUrl("restaurants", img.storage_path),
    })) ?? [];

  const { data: reviewRows } = await supabase
    .from("restaurant_reviews")
    .select(
      `
      id,
      rating,
      title,
      body,
      created_at,
      app_users (
        display_name
      ),
      review_replies (
        id,
        reply_body,
        replied_at
      )
    `
    )
    .eq("restaurant_id", restaurant.id)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  const reviews: ReviewRow[] = (reviewRows ?? []).map((r) => ({
    ...r,
    app_users: Array.isArray(r.app_users)
      ? r.app_users[0] ?? null
      : r.app_users ?? null,
  }));

  let reviewImagesByReview: Record<string, { id: string; url: string | null }[]> = {};
  if (reviews.length > 0) {
    const reviewIds = reviews.map((r) => r.id);
    const { data: reviewImageRows } = await supabase
      .from("review_images")
      .select("id, review_id, storage_path")
      .in("review_id", reviewIds);

    const imgs = (reviewImageRows ?? []) as ReviewImageRow[];
    reviewImagesByReview = imgs.reduce<
      Record<string, { id: string; url: string | null }[]>
    >((acc, img) => {
      const url = getPublicImageUrl("reviews", img.storage_path);
      if (!acc[img.review_id]) acc[img.review_id] = [];
      acc[img.review_id].push({ id: img.id, url });
      return acc;
    }, {});
  }

  let cuisines: CuisineRow[] = [];
  let features: FeatureRow[] = [];

  if (restaurantCuisineRows && restaurantCuisineRows.length > 0) {
    const cuisineIds = restaurantCuisineRows
      .map((r) => r.cuisine_id)
      .filter((id): id is number => typeof id === "number");

    if (cuisineIds.length > 0) {
      const { data } = await supabase
        .from("cuisines")
        .select("id, slug, name, category, sort_order")
        .in("id", cuisineIds)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      cuisines = (data ?? []) as CuisineRow[];
    }
  }

  if (restaurantFeatureRows && restaurantFeatureRows.length > 0) {
    const featureIds = restaurantFeatureRows
      .map((r) => r.feature_id)
      .filter((id): id is number => typeof id === "number");

    if (featureIds.length > 0) {
      const { data } = await supabase
        .from("features")
        .select("id, slug, name, category, icon_key, sort_order")
        .in("id", featureIds)
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      features = (data ?? []) as FeatureRow[];
    }
  }

  const featuresByCategory = features.reduce<Record<string, FeatureRow[]>>(
    (acc, feature) => {
      const key = feature.category || "other";
      if (!acc[key]) acc[key] = [];
      acc[key].push(feature);
      return acc;
    },
    {}
  );

  const featureCategoryLabel = (key: string): string => {
    switch (key) {
      case "dietary":
        return "Dietary options";
      case "amenity":
        return "Amenities";
      case "services":
        return "Services";
      case "atmosphere":
        return "Atmosphere";
      case "bar":
        return "Bar & drinks";
      default:
        return key.replace(/-/g, " ");
    }
  };

  const easyeatsCount = reviews.length;
  const easyeatsRating =
    easyeatsCount > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / easyeatsCount
      : null;

  const { combinedRating, totalCount } = computeCombinedRating(
    {
      rating: restaurant.google_rating,
      count: restaurant.google_review_count || 0,
    },
    {
      rating: restaurant.tripadvisor_rating,
      count: restaurant.tripadvisor_review_count || 0,
    },
    {
      rating: easyeatsRating,
      count: easyeatsCount,
    }
  );

  function formatRating(value: number | null): string {
    if (value == null) return "—";
    return value.toFixed(1);
  }

  function formatDate(dateString: string) {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-ZW", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{restaurant.name}</h1>
          <p className="text-sm text-neutral-600 mt-1">{restaurant.city}</p>
          {restaurant.description && (
            <p className="mt-3 text-sm text-neutral-700">
              {restaurant.description}
            </p>
          )}

          {cuisines.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {cuisines.map((cuisine) => (
                <span
                  key={cuisine.id}
                  className="inline-flex items-center rounded-full border border-neutral-300 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-800"
                >
                  {cuisine.name}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-neutral-700">
            {restaurant.phone_number && (
              <a href={`tel:${restaurant.phone_number}`} className="underline">
                Call: {restaurant.phone_number}
              </a>
            )}
            {restaurant.whatsapp_number && (
              <a
                href={`https://wa.me/${restaurant.whatsapp_number.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                WhatsApp
              </a>
            )}
          </div>
        </div>

        <div className="border border-neutral-200 rounded-2xl p-4 w-full max-w-xs bg-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">
            Rating
          </p>

          {combinedRating == null || totalCount === 0 ? (
            <p className="text-sm text-neutral-700">No ratings yet.</p>
          ) : (
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-[#e81111]">
                  {formatRating(combinedRating)}
                </span>
                <span className="text-xs text-neutral-600">
                  from {totalCount} reviews
                </span>
              </div>
              <p className="text-xs text-neutral-600">
                Across Google, Tripadvisor, and EasyEats.
              </p>
            </div>
          )}

          <div className="mt-3 space-y-1.5 text-xs text-neutral-700">
            <div className="flex justify-between gap-2">
              <span>Google</span>
              <span>
                {formatRating(restaurant.google_rating)}{" "}
                {restaurant.google_review_count > 0 && (
                  <span className="text-neutral-500">
                    ({restaurant.google_review_count})
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Tripadvisor</span>
              <span>
                {formatRating(restaurant.tripadvisor_rating)}{" "}
                {restaurant.tripadvisor_review_count > 0 && (
                  <span className="text-neutral-500">
                    ({restaurant.tripadvisor_review_count})
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span>EasyEats</span>
              <span>
                {formatRating(easyeatsRating)}{" "}
                {reviews.length > 0 && (
                  <span className="text-neutral-500">({reviews.length})</span>
                )}
              </span>
            </div>
          </div>

          <div className="mt-3 space-y-1 text-xs">
            {restaurant.google_url && (
              <a
                href={restaurant.google_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[#e81111] hover:underline"
              >
                View on Google
              </a>
            )}
            {restaurant.tripadvisor_url && (
              <a
                href={restaurant.tripadvisor_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[#e81111] hover:underline"
              >
                View on Tripadvisor
              </a>
            )}
          </div>
        </div>
      </section>

      {gallery.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Gallery</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {gallery.map((img) =>
              img.url ? (
                <div
                  key={img.id}
                  className="relative overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={restaurant.name}
                    className="h-40 w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : null
            )}
          </div>
        </section>
      )}

      {location && (
        <section className="border border-neutral-200 rounded-2xl p-4 bg-white space-y-2">
          <h2 className="text-lg font-semibold">Location</h2>
          <p className="text-sm text-neutral-700">
            {location.address_line1 && (
              <>
                {location.address_line1}
                <br />
              </>
            )}
            {location.address_line2 && (
              <>
                {location.address_line2}
                <br />
              </>
            )}
            {restaurant.city}
            {location.region && `, ${location.region}`}
            {location.postal_code && ` ${location.postal_code}`}
            {location.country && `, ${location.country}`}
          </p>
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-[#e81111]"
            >
              <span>View on Google Maps</span>
              <span aria-hidden>↗</span>
            </a>
          )}
        </section>
      )}

      {features.length > 0 && (
        <section className="border border-neutral-200 rounded-2xl p-4 bg-white space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Features & amenities</h2>
          </div>

          <div className="space-y-3">
            {Object.entries(featuresByCategory).map(
              ([categoryKey, featureList]) => (
                <div key={categoryKey} className="space-y-1">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    {featureCategoryLabel(categoryKey)}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {featureList.map((feature) => (
                      <span
                        key={feature.id}
                        className="inline-flex items-center rounded-full bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-800 border border-neutral-200"
                      >
                        {feature.name}
                      </span>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </section>
      )}

      {menuItems.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Menu</h2>
          <div className="space-y-6">
            {Object.entries(itemsBySection).map(([sectionName, items]) => (
              <div key={sectionName}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2">
                  {sectionName}
                </h3>
                <ul className="space-y-2">
                  {items.map((item) => {
                    const currency = item.currency_code || effectiveCurrency;
                    return (
                      <li
                        key={item.id}
                        className="flex justify-between gap-3 text-sm"
                      >
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-neutral-600">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 text-sm font-semibold text-neutral-800 whitespace-nowrap">
                          <span>{formatPrice(item.price_cents, currency)}</span>
                          {item.imageUrl && (
                            <MenuItemImagePreview imageUrl={item.imageUrl} />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">EasyEats reviews</h2>
          <a
            href={`/restaurants/${restaurant.slug}/review`}
            className="text-xs font-medium text-[#e81111] hover:underline"
          >
            Write a review
          </a>
        </div>

        {reviews.length === 0 ? (
          <p className="text-sm text-neutral-600">
            No reviews yet. Be the first to review this restaurant.
          </p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => {
              const images = reviewImagesByReview[review.id] ?? [];
              const displayName =
                review.app_users?.display_name || "EasyEats user";

              return (
                <article
                  key={review.id}
                  className="border border-neutral-200 rounded-2xl p-4 bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{displayName}</p>
                      <p className="text-xs text-neutral-500">
                        {formatDate(review.created_at)}
                      </p>
                    </div>
                    <div className="text-sm font-semibold text-[#e81111]">
                      {review.rating.toFixed(1)} ★
                    </div>
                  </div>

                  {review.title && (
                    <p className="mt-2 text-sm font-medium text-neutral-800">
                      {review.title}
                    </p>
                  )}
                  {review.body && (
                    <p className="mt-1 text-sm text-neutral-700 whitespace-pre-line">
                      {review.body}
                    </p>
                  )}

                  {review.review_replies?.[0] && (
                    <div className="mt-3 border-l-2 border-neutral-200 pl-3 text-xs space-y-1">
                      <p className="font-semibold text-neutral-800">
                        Reply from the restaurant
                      </p>
                      <p className="text-neutral-700 whitespace-pre-line">
                        {review.review_replies[0].reply_body}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        Posted {formatDate(review.review_replies[0].replied_at)}
                      </p>
                    </div>
                  )}

                  {images.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {images.map((img) =>
                        img.url ? (
                          <div
                            key={img.id}
                            className="relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.url}
                              alt="Review photo"
                              className="h-20 w-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        ) : null
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
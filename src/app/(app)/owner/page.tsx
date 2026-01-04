import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MemberRow = {
  restaurant_id: string;
  role: "OWNER" | "MANAGER" | "STAFF";
  restaurants: {
    id: string;
    name: string;
    city: string | null;
    status: string;
  } | null;
};

type AnalyticsEvent = {
  restaurant_id: string | null;
  event_type: string;
};

export const revalidate = 30;

export default async function OwnerDashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login?next=/owner");
  }

  const supabase = await createSupabaseServerClient();

  const { data: memberRows, error: memberErr } = (await supabase
    .from("restaurant_members")
    .select(
      `
      restaurant_id,
      role,
      restaurants (
        id,
        name,
        city,
        status
      )
    `
    )
    .eq("user_id", user.id)
    .in("role", ["OWNER", "MANAGER"])) as {
    data: MemberRow[] | null;
  };

  if (memberErr) {
    console.error("Owner dashboard members error", memberErr.message);
  }

  const members = memberRows ?? [];

  if (members.length === 0) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Your restaurants</h1>
        <p className="text-sm text-neutral-600">
          You are not currently listed as an owner or manager for any restaurant.
        </p>
      </div>
    );
  }

  const restaurants = members
    .map((m) => m.restaurants)
    .filter((r): r is NonNullable<MemberRow["restaurants"]> => !!r);

  const restaurantIds = restaurants.map((r) => r.id);

  const now = new Date();
  const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last7Iso = last7.toISOString();

  const { data: events } = (await supabase
    .from("analytics_events")
    .select("restaurant_id, event_type")
    .gte("occurred_at", last7Iso)
    .in("restaurant_id", restaurantIds)) as { data: AnalyticsEvent[] | null };

  const eventsArray = events ?? [];

  type RestaurantStats = {
    views: number;
    clicks: number;
    saves: number;
  };

  const statsByRestaurant: Record<string, RestaurantStats> = {};
  for (const id of restaurantIds) {
    statsByRestaurant[id] = { views: 0, clicks: 0, saves: 0 };
  }

  for (const ev of eventsArray) {
    if (!ev.restaurant_id) continue;
    const stats = statsByRestaurant[ev.restaurant_id];
    if (!stats) continue;

    const type = ev.event_type || "";
    if (type.startsWith("view_")) stats.views += 1;
    if (type.startsWith("click_") || type.includes("click") || type.includes("tap")) {
      stats.clicks += 1;
    }
    if (type.includes("save")) stats.saves += 1;
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-semibold mb-1">Your restaurants</h1>
        <p className="text-sm text-neutral-600">
          Activity from the last 7 days. Use this to see how often guests are
          viewing and interacting with your profile.
        </p>
      </section>

      <section className="space-y-3">
        {restaurants.map((r) => {
          const stats = statsByRestaurant[r.id] ?? {
            views: 0,
            clicks: 0,
            saves: 0,
          };

          return (
            <article
              key={r.id}
              className="border border-neutral-200 rounded-2xl bg-white p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">{r.name}</h2>
                  <p className="text-xs text-neutral-500">
                    {r.city || "City not set"}
                  </p>
                </div>
              <div className="flex flex-col items-end gap-2 text-xs">
                <a
                  href={`/owner/restaurants/${r.id}`}
                  className="text-xs font-medium text-[#e81111] hover:underline"
                >
                  Manage
                </a>
                <div className="flex flex-wrap gap-2 text-[11px] text-neutral-600">
                  <a
                    href={`/owner/restaurants/${r.id}/profile`}
                    className="hover:text-[#e81111]"
                  >
                    Profile
                  </a>
                  <span>·</span>
                  <a
                    href={`/owner/restaurants/${r.id}/menu`}
                    className="hover:text-[#e81111]"
                  >
                    Menu
                  </a>
                  <span>·</span>
                  <a
                    href={`/owner/restaurants/${r.id}/gallery`}
                    className="hover:text-[#e81111]"
                  >
                    Gallery
                  </a>
                  <span>·</span>
                  <a
                    href={`/owner/restaurants/${r.id}/reviews`}
                    className="hover:text-[#e81111]"
                  >
                    Reviews
                  </a>
                </div>
              </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl bg-neutral-50 border border-neutral-200 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-500">
                    Views
                  </p>
                  <p className="mt-1 text-lg font-semibold">{stats.views}</p>
                  <p className="text-[11px] text-neutral-600">
                    Restaurant profile impressions
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 border border-neutral-200 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-500">
                    Clicks
                  </p>
                  <p className="mt-1 text-lg font-semibold">{stats.clicks}</p>
                  <p className="text-[11px] text-neutral-600">
                    Phone, WhatsApp & link taps
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 border border-neutral-200 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-500">
                    Saves
                  </p>
                  <p className="mt-1 text-lg font-semibold">{stats.saves}</p>
                  <p className="text-[11px] text-neutral-600">
                    Saved to guest lists
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}


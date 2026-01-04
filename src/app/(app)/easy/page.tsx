import { createSupabaseServerClient } from "@/lib/supabase/server";

type AnalyticsEvent = {
  restaurant_id: string | null;
  event_type: string;
};

type RestaurantRow = {
  id: string;
  name: string;
  city: string | null;
  status: string;
};

interface AdminStats {
  totalRestaurants: number;
  publishedRestaurants: number;
  last7DaysEventsTotal: number;
  last7DaysEventsByType: Record<string, number>;
  topRestaurants: {
    restaurantId: string;
    name: string;
    city: string | null;
    views: number;
    clicks: number;
  }[];
}

export const revalidate = 60;

export default async function EasyAdminDashboardPage() {
  const supabase = await createSupabaseServerClient();

  const { data: restaurants } = (await supabase
    .from("restaurants")
    .select("id, name, city, status")) as { data: RestaurantRow[] | null };

  const totalRestaurants = restaurants?.length ?? 0;
  const publishedRestaurants =
    restaurants?.filter((r) => r.status === "PUBLISHED").length ?? 0;

  const now = new Date();
  const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last7Iso = last7.toISOString();

  const { data: events } = (await supabase
    .from("analytics_events")
    .select("restaurant_id, event_type")
    .gte("occurred_at", last7Iso)) as { data: AnalyticsEvent[] | null };

  const eventsArray = events ?? [];

  const eventsByType: Record<string, number> = {};
  const eventsByRestaurant: Record<
    string,
    { views: number; clicks: number }
  > = {};

  for (const ev of eventsArray) {
    const type = ev.event_type || "unknown";
    eventsByType[type] = (eventsByType[type] ?? 0) + 1;

    if (ev.restaurant_id) {
      const acc =
        eventsByRestaurant[ev.restaurant_id] ??
        (eventsByRestaurant[ev.restaurant_id] = { views: 0, clicks: 0 });

      if (type.startsWith("view_")) acc.views += 1;
      if (type.startsWith("click_") || type.includes("click") || type.includes("tap")) {
        acc.clicks += 1;
      }
    }
  }

  const last7DaysEventsTotal = eventsArray.length;

  const restaurantIndex: Record<string, RestaurantRow> = {};
  for (const r of restaurants ?? []) {
    restaurantIndex[r.id] = r;
  }

  const topRestaurants = Object.entries(eventsByRestaurant)
    .map(([restaurantId, stats]) => {
      const r = restaurantIndex[restaurantId];
      return {
        restaurantId,
        name: r?.name ?? "Unknown",
        city: r?.city ?? null,
        views: stats.views,
        clicks: stats.clicks,
      };
    })
    .filter((x) => x.views > 0 || x.clicks > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  const adminStats: AdminStats = {
    totalRestaurants,
    publishedRestaurants,
    last7DaysEventsTotal,
    last7DaysEventsByType: eventsByType,
    topRestaurants,
  };

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold mb-1">Overview</h1>
        <p className="text-sm text-neutral-600">
          Platform-wide activity in the last 7 days.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Restaurants
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {adminStats.publishedRestaurants}
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            Published (of {adminStats.totalRestaurants} total)
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Events (7 days)
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {adminStats.last7DaysEventsTotal}
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            All tracked impressions, clicks, saves
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Top restaurant views
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {adminStats.topRestaurants[0]?.views ?? 0}
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            Views for #1 restaurant (last 7 days)
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold mb-3">
          Events by type (last 7 days)
        </h2>
        {Object.keys(adminStats.last7DaysEventsByType).length === 0 ? (
          <p className="text-sm text-neutral-600">No events recorded yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {Object.entries(adminStats.last7DaysEventsByType)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <li
                  key={type}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="font-mono text-xs bg-neutral-100 px-2 py-0.5 rounded-full">
                    {type}
                  </span>
                  <span className="text-sm font-medium">{count}</span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold mb-3">
          Top restaurants by views (last 7 days)
        </h2>
        {adminStats.topRestaurants.length === 0 ? (
          <p className="text-sm text-neutral-600">No restaurant activity yet.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {adminStats.topRestaurants.map((r) => (
              <div
                key={r.restaurantId}
                className="flex items-center justify-between gap-2"
              >
                <div>
                  <p className="font-medium">{r.name}</p>
                  {r.city && (
                    <p className="text-xs text-neutral-500">{r.city}</p>
                  )}
                </div>
                <div className="text-right text-xs">
                  <div>
                    <span className="font-semibold">{r.views}</span>{" "}
                    <span className="text-neutral-500">views</span>
                  </div>
                  <div>
                    <span className="font-semibold">{r.clicks}</span>{" "}
                    <span className="text-neutral-500">clicks</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}



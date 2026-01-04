import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveOwnerReply } from "./actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
};

type RestaurantRow = {
  id: string;
  name: string;
};

type ReviewRow = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  app_users: {
    display_name: string | null;
  } | null;
  review_replies: {
    id: string;
    reply_body: string;
    replied_at: string;
  }[];
};

export default async function OwnerRestaurantReviewsPage({
  params,
  searchParams,
}: PageProps) {
  const [{ id: restaurantId }, sp] = await Promise.all([params, searchParams]);

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?next=/owner/restaurants/${restaurantId}/reviews`);
  }

  const supabase = await createSupabaseServerClient();

  const { data: membership, error: memberErr } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", user.id)
    .in("role", ["OWNER", "MANAGER"])
    .maybeSingle();

  if (memberErr) {
    console.error("owner reviews membership error", memberErr.message);
  }

  if (!membership) {
    redirect("/owner");
  }

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("id", restaurantId)
    .maybeSingle<RestaurantRow>();

  if (!restaurant) {
    return notFound();
  }

  const { data: reviews } = (await supabase
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
    .order("created_at", { ascending: false })) as { data: ReviewRow[] | null };

  const list = reviews ?? [];
  const savedFlag = sp.saved === "1";
  const errorKey = sp.error;
  const errorMessage =
    errorKey === "save_failed"
      ? "Could not save reply. Please try again."
      : null;

  function formatDate(dateString: string) {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-ZW", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <main className="space-y-5">
      <section className="space-y-1">
        <h1 className="text-xl font-semibold">Reviews for {restaurant.name}</h1>
        <p className="text-sm text-neutral-600">
          Reply as the restaurant team. Your reply appears under the guest
          review.
        </p>
      </section>

      {savedFlag && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Reply saved.
        </div>
      )}
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-neutral-600">No reviews yet.</p>
      ) : (
        <section className="space-y-4">
          {list.map((review) => {
            const reply = review.review_replies?.[0] ?? null;

            return (
              <article
                key={review.id}
                className="border border-neutral-200 rounded-2xl bg-white p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {review.app_users?.display_name || "EasyEats user"}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatDate(review.created_at)}
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-[#e81111]">
                    {review.rating.toFixed(1)} ★
                  </div>
                </div>

                {review.title && (
                  <p className="text-sm font-medium text-neutral-800">
                    {review.title}
                  </p>
                )}
                {review.body && (
                  <p className="text-sm text-neutral-700 whitespace-pre-line">
                    {review.body}
                  </p>
                )}

                {reply && (
                  <div className="mt-3 border-l-2 border-neutral-200 pl-3 text-xs space-y-1">
                    <p className="font-semibold text-neutral-800">Your reply</p>
                    <p className="text-neutral-700 whitespace-pre-line">
                      {reply.reply_body}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      Posted {formatDate(reply.replied_at)}
                    </p>
                  </div>
                )}

                <form action={saveOwnerReply} className="mt-3 space-y-2 text-xs">
                  <input type="hidden" name="restaurantId" value={restaurant.id} />
                  <input type="hidden" name="reviewId" value={review.id} />

                  <label className="block font-medium text-neutral-800">
                    {reply ? "Edit your reply" : "Write a reply"}
                  </label>
                  <textarea
                    name="replyBody"
                    defaultValue={reply?.reply_body ?? ""}
                    rows={3}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
                    placeholder="Thank them for visiting, acknowledge their feedback, and mention any actions you’re taking."
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="rounded-full bg-[#e81111] px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 active:bg-red-800 transition"
                    >
                      Save reply
                    </button>
                    <p className="text-[11px] text-neutral-500">
                      Leave empty and save to remove your reply.
                    </p>
                  </div>
                </form>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}



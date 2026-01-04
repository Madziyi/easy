import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveReview } from "./actions";
import { ReviewImagesUploader } from "@/components/ReviewImagesUploader";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    reviewId?: string;
    saved?: string;
    error?: string;
  }>;
};

type RestaurantRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
};

type ReviewRow = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
};

export default async function WriteReviewPage({
  params,
  searchParams,
}: PageProps) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?next=/restaurants/${slug}/review`);
  }

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, slug, name, status")
    .eq("slug", slug)
    .eq("status", "PUBLISHED")
    .maybeSingle<RestaurantRow>();

  if (!restaurant) {
    return notFound();
  }

  const searchReviewId = sp.reviewId;
  const savedFlag = sp.saved === "1";
  const errorKey = sp.error;

  let existingReview: ReviewRow | null = null;

  if (searchReviewId) {
    const { data } = await supabase
      .from("restaurant_reviews")
      .select("id, rating, title, body, created_at")
      .eq("id", searchReviewId)
      .eq("restaurant_id", restaurant.id)
      .eq("user_id", user.id)
      .maybeSingle<ReviewRow>();
    existingReview = data ?? null;
  } else {
    const { data } = await supabase
      .from("restaurant_reviews")
      .select("id, rating, title, body, created_at")
      .eq("restaurant_id", restaurant.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<ReviewRow>();
    existingReview = data ?? null;
  }

  const errorMessages: Record<string, string> = {
    invalid_rating: "Please choose a rating between 1 and 5.",
    missing_body: "Please add some details to your review.",
    save_failed: "We could not save your review. Please try again.",
  };

  const errorMessage = errorKey ? errorMessages[errorKey] ?? null : null;

  const reviewId = existingReview?.id ?? searchReviewId ?? null;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <section>
        <p className="text-xs text-neutral-500 mb-1">Reviewing</p>
        <h1 className="text-2xl font-semibold">{restaurant.name}</h1>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        {savedFlag && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            Your review has been saved. You can add photos below.
          </div>
        )}

        <form action={saveReview} className="space-y-4">
          <input type="hidden" name="restaurantId" value={restaurant.id} />
          <input type="hidden" name="slug" value={restaurant.slug} />
          {reviewId && <input type="hidden" name="reviewId" value={reviewId} />}

          <div className="space-y-1">
            <label className="block text-sm font-medium text-neutral-800">
              Rating
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <label
                  key={value}
                  className="flex items-center gap-1 text-sm cursor-pointer"
                >
                  <input
                    type="radio"
                    name="rating"
                    value={value}
                    defaultChecked={existingReview?.rating === value}
                    className="accent-[#e81111]"
                  />
                  <span>{value}★</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-neutral-500">
              1 = very poor, 5 = excellent
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-neutral-800">
              Title (optional)
            </label>
            <input
              type="text"
              name="title"
              defaultValue={existingReview?.title ?? ""}
              maxLength={200}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
              placeholder="Great brunch spot, cosy atmosphere..."
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-neutral-800">
              Your experience
            </label>
            <textarea
              name="body"
              defaultValue={existingReview?.body ?? ""}
              rows={5}
              maxLength={4000}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
              placeholder="Share what you ordered, how the service felt, and anything future guests should know."
            />
            <p className="text-xs text-neutral-500">
              Be honest and constructive. No personal information about staff or
              other guests.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-full bg-[#e81111] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 active:bg-red-800 transition"
            >
              {existingReview ? "Update review" : "Post review"}
            </button>
            <a
              href={`/restaurants/${restaurant.slug}`}
              className="text-xs text-neutral-600 hover:underline"
            >
              Back to restaurant page
            </a>
          </div>
        </form>
      </section>

      {reviewId && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold">Photos (optional)</h2>
          <p className="text-xs text-neutral-600 mb-2">
            You can add up to 5 photos to your review. Choose clear shots of
            dishes, drinks, or the atmosphere.
          </p>
          <ReviewImagesUploader reviewId={reviewId} />
        </section>
      )}
    </main>
  );
}



'use server';

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function saveReview(formData: FormData) {
  const rawRestaurantId = formData.get("restaurantId");
  const rawSlug = formData.get("slug");
  const rawExistingReviewId = formData.get("reviewId");
  const rawRating = formData.get("rating");
  const rawTitle = formData.get("title");
  const rawBody = formData.get("body");

  const restaurantId =
    typeof rawRestaurantId === "string" ? rawRestaurantId : null;
  const slug = typeof rawSlug === "string" ? rawSlug : null;
  const existingReviewId =
    typeof rawExistingReviewId === "string" && rawExistingReviewId.length > 0
      ? rawExistingReviewId
      : null;

  const rating = Number(rawRating ?? 0);
  const title =
    typeof rawTitle === "string" ? rawTitle.trim().substring(0, 200) : "";
  const body =
    typeof rawBody === "string" ? rawBody.trim().substring(0, 4000) : "";

  if (!restaurantId || !slug) {
    redirect("/auth/login");
  }

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    redirect(`/restaurants/${slug}/review?error=invalid_rating`);
  }

  if (!body) {
    redirect(`/restaurants/${slug}/review?error=missing_body`);
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(`/auth/login?next=/restaurants/${slug}/review`);
  }

  const { data: restaurant, error: restErr } = await supabase
    .from("restaurants")
    .select("id, slug, status")
    .eq("id", restaurantId)
    .maybeSingle();

  if (restErr || !restaurant || restaurant.slug !== slug) {
    redirect(`/restaurants/${slug}`);
  }

  let reviewId = existingReviewId;

  if (existingReviewId) {
    const { data, error } = await supabase
      .from("restaurant_reviews")
      .update({
        rating,
        title: title || null,
        body,
      })
      .eq("id", existingReviewId)
      .eq("restaurant_id", restaurant.id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      console.error("Update review error", error?.message);
      redirect(`/restaurants/${slug}/review?error=save_failed`);
    }

    reviewId = data.id;
  } else {
    const { data, error } = await supabase
      .from("restaurant_reviews")
      .insert({
        restaurant_id: restaurant.id,
        user_id: user.id,
        rating,
        title: title || null,
        body,
        is_published: true,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("Insert review error", error?.message);
      redirect(`/restaurants/${slug}/review?error=save_failed`);
    }

    reviewId = data.id;
  }

  redirect(`/restaurants/${slug}/review?reviewId=${reviewId}&saved=1`);
}



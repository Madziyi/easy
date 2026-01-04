'use server';

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function saveOwnerReply(formData: FormData) {
  const rawRestaurantId = formData.get("restaurantId");
  const rawReviewId = formData.get("reviewId");
  const rawBody = formData.get("replyBody");

  const restaurantId =
    typeof rawRestaurantId === "string" ? rawRestaurantId : null;
  const reviewId = typeof rawReviewId === "string" ? rawReviewId : null;
  const body =
    typeof rawBody === "string" ? rawBody.trim().substring(0, 4000) : "";

  if (!restaurantId || !reviewId) {
    redirect("/owner");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/owner");
  }

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

  if (!body) {
    await supabase
      .from("review_replies")
      .delete()
      .eq("review_id", reviewId)
      .eq("restaurant_id", restaurantId);

    redirect(`/owner/restaurants/${restaurantId}/reviews?saved=1`);
  }

  const { error } = await supabase
    .from("review_replies")
    .upsert(
      {
        review_id: reviewId,
        restaurant_id: restaurantId,
        reply_body: body,
        replied_by: user.id,
      },
      { onConflict: "review_id" }
    );

  if (error) {
    console.error("saveOwnerReply error", error.message);
    redirect(`/owner/restaurants/${restaurantId}/reviews?error=save_failed`);
  }

  redirect(`/owner/restaurants/${restaurantId}/reviews?saved=1`);
}



'use server';

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function deleteGalleryImage(formData: FormData) {
  const rawRestaurantId = formData.get("restaurantId");
  const rawImageId = formData.get("imageId");

  const restaurantId =
    typeof rawRestaurantId === "string" ? rawRestaurantId : null;
  const imageId = typeof rawImageId === "string" ? rawImageId : null;

  if (!restaurantId || !imageId) {
    redirect("/owner");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?next=/owner/restaurants/${restaurantId}/gallery`);
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

  const { data: img } = await supabase
    .from("restaurant_images")
    .select("storage_path")
    .eq("id", imageId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!img) {
    redirect(`/owner/restaurants/${restaurantId}/gallery`);
  }

  await supabase
    .from("restaurant_images")
    .delete()
    .eq("id", imageId)
    .eq("restaurant_id", restaurantId);

  const { error: storageError } = await supabase.storage
    .from("restaurants")
    .remove([img.storage_path]);

  if (storageError) {
    console.error("deleteGalleryImage storage error", storageError.message);
  }

  redirect(`/owner/restaurants/${restaurantId}/gallery?saved=1`);
}



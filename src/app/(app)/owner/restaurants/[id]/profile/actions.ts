'use server';

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getStr(formData: FormData, name: string, max = 255) {
  const raw = formData.get(name);
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export async function saveRestaurantProfile(formData: FormData) {
  const rawRestaurantId = formData.get("restaurantId");
  const restaurantId =
    typeof rawRestaurantId === "string" ? rawRestaurantId : null;

  if (!restaurantId) {
    redirect("/owner");
  }

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

  const name = getStr(formData, "name", 160);
  const city = getStr(formData, "city", 120);
  const description = getStr(formData, "description", 4000);

  const phone_number = getStr(formData, "phone_number", 50);
  const whatsapp_number = getStr(formData, "whatsapp_number", 50);
  const contact_email = getStr(formData, "contact_email", 255);
  const website_url = getStr(formData, "website_url", 512);

  const facebook_url = getStr(formData, "facebook_url", 512);
  const instagram_url = getStr(formData, "instagram_url", 512);
  const tiktok_url = getStr(formData, "tiktok_url", 512);

  const google_url = getStr(formData, "google_url", 512);
  const tripadvisor_url = getStr(formData, "tripadvisor_url", 512);

  const address_line1 = getStr(formData, "address_line1", 255);
  const address_line2 = getStr(formData, "address_line2", 255);
  const region = getStr(formData, "region", 120);
  const postal_code = getStr(formData, "postal_code", 40);
  const country = getStr(formData, "country", 120);
  const google_maps_url = getStr(formData, "google_maps_url", 512);

  const latRaw = formData.get("latitude");
  const lonRaw = formData.get("longitude");

  const latitude =
    typeof latRaw === "string" && latRaw.trim() !== ""
      ? Number(latRaw)
      : null;
  const longitude =
    typeof lonRaw === "string" && lonRaw.trim() !== ""
      ? Number(lonRaw)
      : null;

  if (
    (latitude != null && !Number.isFinite(latitude)) ||
    (longitude != null && !Number.isFinite(longitude))
  ) {
    redirect(`/owner/restaurants/${restaurantId}/profile?error=invalid_coordinates`);
  }

  const { error: restErr } = await supabase
    .from("restaurants")
    .update({
      ...(name !== null ? { name } : {}),
      ...(city !== null ? { city } : {}),
      description,
      phone_number,
      whatsapp_number,
      contact_email,
      website_url,
      facebook_url,
      instagram_url,
      tiktok_url,
      google_url,
      tripadvisor_url,
    })
    .eq("id", restaurantId);

  if (restErr) {
    console.error("saveRestaurantProfile restaurant error", restErr.message);
    redirect(`/owner/restaurants/${restaurantId}/profile?error=save_failed`);
  }

  const { data: existingLocation } = await supabase
    .from("restaurant_locations")
    .select("restaurant_id")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  const locationPayload = {
    restaurant_id: restaurantId,
    address_line1,
    address_line2,
    region,
    postal_code,
    country,
    latitude,
    longitude,
    google_maps_url,
  };

  let locError = null;

  if (existingLocation) {
    const { error } = await supabase
      .from("restaurant_locations")
      .update(locationPayload)
      .eq("restaurant_id", restaurantId);
    locError = error;
  } else {
    const { error } = await supabase
      .from("restaurant_locations")
      .insert(locationPayload);
    locError = error;
  }

  if (locError) {
    console.error("saveRestaurantProfile location error", locError.message);
    redirect(`/owner/restaurants/${restaurantId}/profile?error=save_failed`);
  }

  const parseIntIds = (values: FormDataEntryValue[]): number[] => {
    const result: number[] = [];
    for (const v of values) {
      if (typeof v !== "string") continue;
      const trimmed = v.trim();
      if (!trimmed) continue;
      const n = Number(trimmed);
      if (!Number.isInteger(n) || n <= 0) continue;
      if (!result.includes(n)) result.push(n);
    }
    return result;
  };

  const [selectedCuisineIds, selectedFeatureIds] = [
    parseIntIds(formData.getAll("cuisine_ids")),
    parseIntIds(formData.getAll("feature_ids")),
  ];

  try {
    const [{ data: existingCuisineRows }, { data: existingFeatureRows }] =
      await Promise.all([
        supabase
          .from("restaurant_cuisines")
          .select("cuisine_id")
          .eq("restaurant_id", restaurantId),
        supabase
          .from("restaurant_features")
          .select("feature_id")
          .eq("restaurant_id", restaurantId),
      ]);

    const existingCuisineIds = new Set(
      (existingCuisineRows ?? []).map((r) => r.cuisine_id as number)
    );
    const existingFeatureIds = new Set(
      (existingFeatureRows ?? []).map((r) => r.feature_id as number)
    );

    const cuisineIdsToAdd = selectedCuisineIds.filter(
      (id) => !existingCuisineIds.has(id)
    );
    const cuisineIdsToRemove = Array.from(existingCuisineIds).filter(
      (id) => !selectedCuisineIds.includes(id)
    );

    const featureIdsToAdd = selectedFeatureIds.filter(
      (id) => !existingFeatureIds.has(id)
    );
    const featureIdsToRemove = Array.from(existingFeatureIds).filter(
      (id) => !selectedFeatureIds.includes(id)
    );

    const inserts: Promise<unknown>[] = [];
    const deletes: Promise<unknown>[] = [];

    if (cuisineIdsToAdd.length > 0) {
      inserts.push(
        supabase.from("restaurant_cuisines").insert(
          cuisineIdsToAdd.map((cuisineId) => ({
            restaurant_id: restaurantId,
            cuisine_id: cuisineId,
          }))
        )
      );
    }

    if (cuisineIdsToRemove.length > 0) {
      deletes.push(
        supabase
          .from("restaurant_cuisines")
          .delete()
          .eq("restaurant_id", restaurantId)
          .in("cuisine_id", cuisineIdsToRemove)
      );
    }

    if (featureIdsToAdd.length > 0) {
      inserts.push(
        supabase.from("restaurant_features").insert(
          featureIdsToAdd.map((featureId) => ({
            restaurant_id: restaurantId,
            feature_id: featureId,
          }))
        )
      );
    }

    if (featureIdsToRemove.length > 0) {
      deletes.push(
        supabase
          .from("restaurant_features")
          .delete()
          .eq("restaurant_id", restaurantId)
          .in("feature_id", featureIdsToRemove)
      );
    }

    if (inserts.length > 0 || deletes.length > 0) {
      await Promise.all([...inserts, ...deletes]);
    }
  } catch (err) {
    console.error("saveRestaurantProfile cuisines/features error", err);
    redirect(`/owner/restaurants/${restaurantId}/profile?error=save_failed`);
  }

  redirect(`/owner/restaurants/${restaurantId}/profile?saved=1`);
}



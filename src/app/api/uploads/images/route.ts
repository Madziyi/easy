import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_RESTAURANT_GALLERY_IMAGES = 15;
const MAX_REVIEW_IMAGES = 5;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

type EntityType = "restaurant_gallery" | "review";

function getExtensionFromMime(type: string): string {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "bin";
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();

  const rawEntityType = formData.get("entityType");
  const entityType =
    typeof rawEntityType === "string" ? (rawEntityType as EntityType) : null;

  if (!entityType) {
    return NextResponse.json(
      { error: "Missing or invalid entityType" },
      { status: 400 }
    );
  }

  const filesRaw = formData.getAll("files");
  const files = filesRaw.filter((v): v is File => v instanceof File);

  if (!files.length) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "One or more files are too large (max 5MB each)." },
        { status: 400 }
      );
    }
  }

  try {
    switch (entityType) {
      case "restaurant_gallery": {
        const rawRestaurantId = formData.get("restaurantId");
        const restaurantId =
          typeof rawRestaurantId === "string" ? rawRestaurantId : null;

        if (!restaurantId) {
          return NextResponse.json(
            { error: "Missing restaurantId for restaurant_gallery upload" },
            { status: 400 }
          );
        }

        const { count, error: countError } = await supabase
          .from("restaurant_images")
          .select("*", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId);

        if (countError) {
          console.error("Count restaurant_images error", countError.message);
          return NextResponse.json(
            { error: "Failed to check gallery image count" },
            { status: 500 }
          );
        }

        const existingCount = count ?? 0;
        if (existingCount + files.length > MAX_RESTAURANT_GALLERY_IMAGES) {
          return NextResponse.json(
            {
              error: `You can only have up to ${MAX_RESTAURANT_GALLERY_IMAGES} gallery images per restaurant.`,
            },
            { status: 400 }
          );
        }

        const uploaded: {
          url: string | null;
          [key: string]: unknown;
        }[] = [];

        for (const file of files) {
          const ext = getExtensionFromMime(file.type);
          const imageId = crypto.randomUUID();
          const key = `${restaurantId}/gallery/${imageId}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("restaurants")
            .upload(key, file, {
              cacheControl: "3600",
              upsert: false,
              contentType: file.type,
            });

          if (uploadError) {
            console.error(
              "Storage upload error (restaurant_gallery)",
              uploadError.message
            );
            return NextResponse.json(
              { error: "Failed to upload image" },
              { status: 500 }
            );
          }

          const { data: row, error: insertError } = await supabase
            .from("restaurant_images")
            .insert({
              restaurant_id: restaurantId,
              storage_path: key,
              image_type: "GALLERY",
              created_by: user.id,
            })
            .select("*")
            .single();

          if (insertError) {
            console.error(
              "Insert restaurant_images error",
              insertError.message
            );
            return NextResponse.json(
              { error: "Failed to save image metadata" },
              { status: 500 }
            );
          }

          const { data: urlData } = supabase.storage
            .from("restaurants")
            .getPublicUrl(key);

          uploaded.push({
            ...row,
            url: urlData.publicUrl,
          });
        }

        return NextResponse.json(
          { success: true, images: uploaded },
          { status: 200 }
        );
      }

      case "review": {
        const rawReviewId = formData.get("reviewId");
        const reviewId = typeof rawReviewId === "string" ? rawReviewId : null;

        if (!reviewId) {
          return NextResponse.json(
            { error: "Missing reviewId for review upload" },
            { status: 400 }
          );
        }

        const { count, error: countError } = await supabase
          .from("review_images")
          .select("*", { count: "exact", head: true })
          .eq("review_id", reviewId);

        if (countError) {
          console.error("Count review_images error", countError.message);
          return NextResponse.json(
            { error: "Failed to check review image count" },
            { status: 500 }
          );
        }

        const existingCount = count ?? 0;
        if (existingCount + files.length > MAX_REVIEW_IMAGES) {
          return NextResponse.json(
            {
              error: `You can only have up to ${MAX_REVIEW_IMAGES} images per review.`,
            },
            { status: 400 }
          );
        }

        const uploaded: {
          url: string | null;
          [key: string]: unknown;
        }[] = [];

        for (const file of files) {
          const ext = getExtensionFromMime(file.type);
          const imageId = crypto.randomUUID();
          const key = `${user.id}/${imageId}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("reviews")
            .upload(key, file, {
              cacheControl: "3600",
              upsert: false,
              contentType: file.type,
            });

          if (uploadError) {
            console.error("Storage upload error (review)", uploadError.message);
            return NextResponse.json(
              { error: "Failed to upload image" },
              { status: 500 }
            );
          }

          const { data: row, error: insertError } = await supabase
            .from("review_images")
            .insert({
              review_id: reviewId,
              storage_path: key,
              created_by: user.id,
            })
            .select("*")
            .single();

          if (insertError) {
            console.error("Insert review_images error", insertError.message);
            return NextResponse.json(
              { error: "Failed to save review image metadata" },
              { status: 500 }
            );
          }

          const { data: urlData } = supabase.storage
            .from("reviews")
            .getPublicUrl(key);

          uploaded.push({
            ...row,
            url: urlData.publicUrl,
          });
        }

        return NextResponse.json(
          { success: true, images: uploaded },
          { status: 200 }
        );
      }

      default:
        return NextResponse.json(
          { error: `Unsupported entityType: ${entityType}` },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("Unexpected upload handler error", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}


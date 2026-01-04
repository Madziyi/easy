import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const formData = await req.formData();
  const restaurantId = formData.get("restaurantId");
  const menuItemId = formData.get("menuItemId");
  const file = formData.get("file");

  if (
    typeof restaurantId !== "string" ||
    typeof menuItemId !== "string" ||
    !(file instanceof File)
  ) {
    return new NextResponse("Bad request", { status: 400 });
  }

  // RLS-enforced client for auth/membership checks
  const supabase = await createSupabaseServerClient();

  const { data: membership, error: memberErr } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", user.id)
    .in("role", ["OWNER", "MANAGER"])
    .maybeSingle();

  if (memberErr) {
    console.error("menu-item-image membership error", memberErr.message);
    return new NextResponse("Error checking membership", { status: 500 });
  }
  if (!membership) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { data: item, error: itemErr } = await supabase
    .from("menu_items")
    .select("id, menu_id, image_storage_path")
    .eq("id", menuItemId)
    .maybeSingle();

  if (itemErr) {
    console.error("menu-item-image fetch item error", itemErr.message);
    return new NextResponse("Error fetching menu item", { status: 500 });
  }
  if (!item) {
    return new NextResponse("Menu item not found", { status: 404 });
  }

  const { data: menuRow, error: menuErr } = await supabase
    .from("menus")
    .select("id, restaurant_id")
    .eq("id", item.menu_id)
    .maybeSingle();

  if (menuErr) {
    console.error("menu-item-image fetch menu error", menuErr.message);
    return new NextResponse("Error fetching menu", { status: 500 });
  }
  if (!menuRow || menuRow.restaurant_id !== restaurantId) {
    return new NextResponse("Menu item not found", { status: 404 });
  }

  // Service-role client to bypass RLS for storage + update
  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return new NextResponse("Unsupported file type", { status: 415 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext =
    file.name.split(".").pop()?.toLowerCase() ||
    (file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
      ? "webp"
      : "jpg");

  const newPath = `menu-items/${restaurantId}/${menuItemId}-${randomUUID()}.${ext}`;

  if (item.image_storage_path) {
    const { error: removeErr } = await serviceSupabase.storage
      .from("restaurants")
      .remove([item.image_storage_path]);
    if (removeErr) {
      console.error("menu-item-image remove old error", removeErr.message);
    }
  }

  const { error: uploadErr } = await serviceSupabase.storage
    .from("restaurants")
    .upload(newPath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadErr) {
    console.error("menu-item-image upload error", uploadErr.message);
    return new NextResponse("Upload failed", { status: 500 });
  }

  const { error: updateErr } = await serviceSupabase
    .from("menu_items")
    .update({ image_storage_path: newPath })
    .eq("id", menuItemId);

  if (updateErr) {
    console.error("menu-item-image update error", updateErr.message);
    return new NextResponse("Could not update menu item", { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
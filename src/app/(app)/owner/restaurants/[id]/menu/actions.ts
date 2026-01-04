'use server';

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parse } from "csv-parse/sync";

function toCents(raw: FormDataEntryValue | null): number {
  if (typeof raw !== "string") return 0;
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export async function saveMenuItem(formData: FormData) {
  const restaurantId = formData.get("restaurantId");
  const menuId = formData.get("menuId");
  const rawItemId = formData.get("itemId");

  const restId = typeof restaurantId === "string" ? restaurantId : null;
  const mId = typeof menuId === "string" ? menuId : null;
  const itemId =
    typeof rawItemId === "string" && rawItemId.length > 0 ? rawItemId : null;

  if (!restId || !mId) {
    redirect("/owner");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?next=/owner/restaurants/${restId}/menu`);
  }

  const supabase = await createSupabaseServerClient();

  const { data: membership } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role")
    .eq("restaurant_id", restId)
    .eq("user_id", user.id)
    .in("role", ["OWNER", "MANAGER"])
    .maybeSingle();

  if (!membership) {
    redirect("/owner");
  }

  const getStr = (name: string, max = 255) => {
    const raw = formData.get(name);
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
  };

  const section_name = getStr("section_name", 120);
  const itemName = getStr("name", 160);
  const description = getStr("description", 4000);
  const price_cents = toCents(formData.get("price"));
  const currency_code = getStr("currency_code", 10) ?? "USD";

  if (!itemName || price_cents <= 0) {
    redirect(`/owner/restaurants/${restId}/menu?error=invalid_item`);
  }

  if (itemId) {
    const { error } = await supabase
      .from("menu_items")
      .update({
        section_name,
        name: itemName,
        description,
        price_cents,
        currency_code,
      })
      .eq("id", itemId)
      .eq("menu_id", mId);

    if (error) {
      console.error("saveMenuItem update error", error.message);
      redirect(`/owner/restaurants/${restId}/menu?error=save_failed`);
    }
  } else {
    const { error } = await supabase.from("menu_items").insert({
      menu_id: mId,
      section_name,
      name: itemName,
      description,
      price_cents,
      currency_code,
    });

    if (error) {
      console.error("saveMenuItem insert error", error.message);
      redirect(`/owner/restaurants/${restId}/menu?error=save_failed`);
    }
  }

  redirect(`/owner/restaurants/${restId}/menu?saved=1`);
}

export async function deleteMenuItem(formData: FormData) {
  const restaurantId = formData.get("restaurantId");
  const menuId = formData.get("menuId");
  const itemId = formData.get("itemId");

  const restId = typeof restaurantId === "string" ? restaurantId : null;
  const mId = typeof menuId === "string" ? menuId : null;
  const iId = typeof itemId === "string" ? itemId : null;

  if (!restId || !mId || !iId) {
    redirect("/owner");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?next=/owner/restaurants/${restId}/menu`);
  }

  const supabase = await createSupabaseServerClient();

  const { data: membership } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role")
    .eq("restaurant_id", restId)
    .eq("user_id", user.id)
    .in("role", ["OWNER", "MANAGER"])
    .maybeSingle();

  if (!membership) {
    redirect("/owner");
  }

  const { error } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", iId)
    .eq("menu_id", mId);

  if (error) {
    console.error("deleteMenuItem error", error.message);
    redirect(`/owner/restaurants/${restId}/menu?error=delete_failed`);
  }

  redirect(`/owner/restaurants/${restId}/menu?saved=1`);
}

type CsvRow = {
  section_name?: string;
  name?: string;
  description?: string;
  price?: string;
  currency_code?: string;
  [key: string]: unknown;
};

export async function importMenuCsv(formData: FormData) {
  const rawRestaurantId = formData.get("restaurantId");
  const rawMenuId = formData.get("menuId");
  const file = formData.get("file");

  const restaurantId =
    typeof rawRestaurantId === "string" ? rawRestaurantId : null;
  const menuId = typeof rawMenuId === "string" ? rawMenuId : null;

  if (!restaurantId || !menuId || !(file instanceof File)) {
    redirect("/owner");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?next=/owner/restaurants/${restaurantId}/menu`);
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

  let csvText = "";
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    csvText = buffer.toString("utf-8");
  } catch (e) {
    console.error("importMenuCsv read error", e);
    redirect(
      `/owner/restaurants/${restaurantId}/menu?error=import_read_failed`
    );
  }

  let records: CsvRow[] = [];
  try {
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      trim: true,
    }) as CsvRow[];
  } catch (e) {
    console.error("importMenuCsv parse error", e);
    redirect(
      `/owner/restaurants/${restaurantId}/menu?error=import_parse_failed`
    );
  }

  const [{ data: restaurant }, { data: existingItemsRaw }] = await Promise.all([
    supabase
      .from("restaurants")
      .select("id, currency_code")
      .eq("id", restaurantId)
      .maybeSingle(),
    supabase
      .from("menu_items")
      .select("id, section_name, name, image_storage_path, menu_id")
      .eq("menu_id", menuId),
  ]);

  const defaultCurrency = restaurant?.currency_code || "USD";

  const existingMap = new Map<string, { image_storage_path: string | null }>();
  for (const row of existingItemsRaw ?? []) {
    const key = `${(row.section_name || "").trim()}::${row.name.trim()}`;
    existingMap.set(key, {
      image_storage_path: row.image_storage_path ?? null,
    });
  }

  const itemsToInsert = records
    .map((row) => {
      const rawName = row.name ?? "";
      const name = String(rawName).trim();
      if (!name) return null;

      const rawSection = row.section_name ?? "";
      const section_name = String(rawSection).trim() || null;

      const rawDescription = row.description ?? "";
      const description = String(rawDescription).trim() || null;

      const rawPrice = row.price ?? "";
      const priceNumber = Number(String(rawPrice).trim());
      if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
        return null;
      }
      const price_cents = Math.round(priceNumber * 100);

      const rawCurrency = row.currency_code ?? "";
      const currency_code = String(rawCurrency).trim() || defaultCurrency;

      const key = `${(section_name || "").trim()}::${name}`;
      const existing = existingMap.get(key);

      return {
        menu_id: menuId,
        section_name,
        name,
        description,
        price_cents,
        currency_code,
        image_storage_path: existing?.image_storage_path ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (itemsToInsert.length === 0) {
    redirect(`/owner/restaurants/${restaurantId}/menu?error=import_no_items`);
  }

  const { error: delError } = await supabase
    .from("menu_items")
    .delete()
    .eq("menu_id", menuId);

  if (delError) {
    console.error("importMenuCsv delete error", delError.message);
    redirect(
      `/owner/restaurants/${restaurantId}/menu?error=import_delete_failed`
    );
  }

  const { error: insertError } = await supabase
    .from("menu_items")
    .insert(itemsToInsert);

  if (insertError) {
    console.error("importMenuCsv insert error", insertError.message);
    redirect(
      `/owner/restaurants/${restaurantId}/menu?error=import_insert_failed`
    );
  }

  redirect(`/owner/restaurants/${restaurantId}/menu?saved=1`);
}


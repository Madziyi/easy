import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RestaurantRow = {
  id: string;
  name: string;
  currency_code: string;
};

type MenuRow = {
  id: string;
  is_default: boolean;
};

type MenuItemRow = {
  id: string;
  section_name: string | null;
  name: string;
  description: string | null;
  price_cents: number;
  currency_code: string | null;
  menu_id: string;
  image_storage_path: string | null;
};

function csvEscape(value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str === "") return "";
  const mustQuote =
    str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r");
  const escaped = str.replace(/"/g, '""');
  return mustQuote ? `"${escaped}"` : escaped;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: restaurantId } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
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
    console.error("menu export membership error", memberErr.message);
    return new NextResponse("Error checking membership", { status: 500 });
  }

  if (!membership) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const [{ data: restaurant }, { data: menus }] =
    await Promise.all([
      supabase
        .from("restaurants")
        .select("id, name, currency_code")
        .eq("id", restaurantId)
        .maybeSingle<RestaurantRow>(),
      supabase
        .from("menus")
        .select("id, is_default")
        .eq("restaurant_id", restaurantId) as unknown as {
        data: MenuRow[] | null;
      },
      supabase
        .from("menu_items")
        .select(
          `
          id,
          section_name,
          name,
          description,
          price_cents,
          currency_code,
          image_storage_path,
          menu_id
        `
        )
        .eq("restaurant_id", restaurantId)
        .eq("menu_id", supabase.rpc ? undefined : "") as unknown as {
        data: MenuItemRow[] | null;
      },
    ]);

  if (!restaurant) {
    return new NextResponse("Restaurant not found", { status: 404 });
  }

  const allMenus = menus ?? [];
  const defaultMenu = allMenus.find((m) => m.is_default) ?? allMenus[0];
  if (!defaultMenu) {
    return new NextResponse("No menu found for this restaurant", {
      status: 404,
    });
  }

  const restaurantCurrency = restaurant.currency_code || "USD";

  const { data: defaultMenuItems } = (await supabase
    .from("menu_items")
    .select(
      `
      id,
      section_name,
      name,
      description,
      price_cents,
      currency_code,
      image_storage_path,
      menu_id
    `
    )
    .eq("menu_id", defaultMenu.id)) as { data: MenuItemRow[] | null };

  const menuItems = defaultMenuItems ?? [];

  const header = "section_name,name,description,price,currency_code";
  const rows: string[] = [header];

  for (const item of menuItems) {
    const priceValue = (item.price_cents ?? 0) / 100;
    const priceStr = priceValue.toFixed(2);

    const row = [
      csvEscape(item.section_name),
      csvEscape(item.name),
      csvEscape(item.description),
      csvEscape(priceStr),
      csvEscape(item.currency_code || restaurantCurrency),
    ].join(",");

    rows.push(row);
  }

  const csvContent = rows.join("\r\n");
  const filenameSafeName =
    restaurant.name.replace(/[^a-zA-Z0-9\-]+/g, "-").toLowerCase() || "menu";

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameSafeName}-menu.csv"`,
    },
  });
}


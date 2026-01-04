import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveMenuItem, deleteMenuItem, importMenuCsv } from "./actions";
import { getPublicImageUrl } from "@/lib/storage";
import { MenuItemImageUploader } from "@/components/MenuItemImageUploader";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
};

type RestaurantRow = {
  id: string;
  name: string;
  currency_code: string;
};

type MenuRow = {
  id: string;
  name: string | null;
  is_default: boolean;
};

type MenuItemRow = {
  id: string;
  section_name: string | null;
  name: string;
  description: string | null;
  price_cents: number;
  currency_code: string | null;
  image_storage_path: string | null;
};

function formatPrice(cents: number, currency: string) {
  const value = cents / 100;
  return new Intl.NumberFormat("en-ZW", {
    style: "currency",
    currency,
  }).format(value);
}

export default async function OwnerRestaurantMenuPage({
  params,
  searchParams,
}: PageProps) {
  const [{ id: restaurantId }, sp] = await Promise.all([params, searchParams]);

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

  const [{ data: restaurant }, { data: menus }] = await Promise.all([
    supabase
      .from("restaurants")
      .select("id, name, currency_code")
      .eq("id", restaurantId)
      .maybeSingle<RestaurantRow>(),
    supabase
      .from("menus")
      .select("id, name, is_default")
      .eq("restaurant_id", restaurantId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }) as unknown as {
      data: MenuRow[] | null;
    },
  ]);

  if (!restaurant) {
    redirect("/owner");
  }

  const savedFlag = sp.saved === "1";
  const errorKey = sp.error;
  const errorMessage =
    errorKey === "invalid_item"
      ? "Please provide a name and valid price for the item."
      : errorKey === "save_failed"
      ? "Could not save your changes. Please try again."
      : errorKey === "delete_failed"
      ? "Could not delete the item. Please try again."
    : errorKey === "import_read_failed"
      ? "Could not read the CSV file. Please try again."
    : errorKey === "import_parse_failed"
      ? "Could not parse the CSV. Check headers and formatting."
    : errorKey === "import_no_items"
      ? "No valid menu items were found in the CSV."
    : errorKey === "import_delete_failed"
      ? "Could not clear existing items before import."
    : errorKey === "import_insert_failed"
      ? "Could not insert new items from the CSV."
      : null;

  const allMenus = menus ?? [];
  const defaultMenu = allMenus.find((m) => m.is_default) ?? allMenus[0];

  if (!defaultMenu) {
    return (
      <main className="space-y-4">
        <h1 className="text-xl font-semibold">Menu – {restaurant.name}</h1>
        <p className="text-sm text-neutral-600">
          No menu has been created yet for this restaurant. For now, create a
          default menu row in Supabase (or add a UI later to create it).
        </p>
      </main>
    );
  }

  const effectiveCurrency = restaurant.currency_code || "USD";

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
    .eq("menu_id", defaultMenu.id)) as {
    data: MenuItemRow[] | null;
  };

  const menuItemsRaw = defaultMenuItems ?? [];

  const menuItems = menuItemsRaw.map((item) => ({
    ...item,
    imageUrl: item.image_storage_path
      ? getPublicImageUrl("restaurants", item.image_storage_path)
      : null,
  }));

  const itemsBySection = menuItems.reduce<
    Record<string, typeof menuItems>
  >((acc, item) => {
    const key = item.section_name || "Menu";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <main className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-xl font-semibold">Menu – {restaurant.name}</h1>
        <p className="text-sm text-neutral-600">
          Manage your menu items for the default menu.
        </p>
      </section>

      {savedFlag && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Menu updated.
        </div>
      )}
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      {/* CSV tools */}
      <section className="border border-neutral-200 rounded-2xl bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold">CSV import/export</h2>
        <p className="text-xs text-neutral-600">
          Use CSV to bulk edit your menu. Export your current menu, edit in Excel or Google Sheets,
          then import it back. The import replaces all items in this menu.
        </p>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <a
            href={`/owner/restaurants/${restaurant.id}/menu/export`}
            className="inline-flex items-center rounded-full border border-neutral-300 px-3 py-1.5 font-medium hover:border-[#e81111] hover:text-[#e81111] transition"
          >
            Download current menu as CSV
          </a>
        </div>

        <div className="pt-3 border-t border-neutral-200">
          <form
            action={importMenuCsv}
            className="flex flex-col md:flex-row md:items-center gap-3"
            encType="multipart/form-data"
          >
            <input type="hidden" name="restaurantId" value={restaurant.id} />
            <input type="hidden" name="menuId" value={defaultMenu.id} />
            <div className="flex-1">
              <label className="block text-xs font-medium text-neutral-800 mb-1">
                Import CSV (replaces items in this menu)
              </label>
              <input
                type="file"
                name="file"
                accept=".csv,text/csv"
                required
                className="w-full text-xs"
              />
              <p className="mt-1 text-[11px] text-neutral-500">
                Expected headers: section_name, name, description, price, currency_code.
                Descriptions can contain commas and quotes.
              </p>
            </div>
            <button
              type="submit"
              className="rounded-full bg-[#e81111] px-4 py-2 text-xs font-medium text-white hover:bg-red-700 active:bg-red-800 transition"
            >
              Import CSV
            </button>
          </form>
        </div>
      </section>

      <section className="border border-neutral-200 rounded-2xl bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold">Add a menu item</h2>
        <form
          action={saveMenuItem}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <input type="hidden" name="restaurantId" value={restaurant.id} />
          <input type="hidden" name="menuId" value={defaultMenu.id} />

          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-800">
              Section (e.g. Starters)
            </label>
            <input
              type="text"
              name="section_name"
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-800">
              Item name
            </label>
            <input
              type="text"
              name="name"
              required
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
              placeholder="Grilled chicken wrap"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="block text-xs font-medium text-neutral-800">
              Description (optional)
            </label>
            <textarea
              name="description"
              rows={2}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
              placeholder="Key ingredients, spice level, etc."
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-800">
              Price ({effectiveCurrency})
            </label>
            <input
              type="number"
              step="0.01"
              name="price"
              required
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
              placeholder="10.00"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-800">
              Currency code
            </label>
            <input
              type="text"
              name="currency_code"
              defaultValue={effectiveCurrency}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-[#e81111] focus:ring-1 focus:ring-[#e81111]"
            />
          </div>

          <div className="md:col-span-2 flex items-center justify-end">
            <button
              type="submit"
              className="rounded-full bg-[#e81111] px-4 py-2 text-xs font-medium text-white hover:bg-red-700 active:bg-red-800 transition"
            >
              Add item
            </button>
          </div>
        </form>
      </section>

      <section className="border border-neutral-200 rounded-2xl bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold">Current menu</h2>

        {menuItems.length === 0 ? (
          <p className="text-xs text-neutral-600">
            No items yet. Add your first menu item above.
          </p>
        ) : (
          Object.entries(itemsBySection).map(([sectionName, sectionItems]) => (
            <div key={sectionName} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {sectionName}
              </h3>
              <div className="space-y-2">
                {sectionItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 border border-neutral-100 rounded-xl p-3"
                  >
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-neutral-600">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-end justify-between md:flex-col md:items-end gap-2">
                      <p className="text-sm font-semibold text-neutral-900">
                        {formatPrice(
                          item.price_cents,
                          item.currency_code || effectiveCurrency
                        )}
                      </p>
                      <div className="flex flex-col items-end gap-1">
                        <MenuItemImageUploader
                          restaurantId={restaurant.id}
                          menuItemId={item.id}
                          hasImage={!!item.imageUrl}
                        />
                        <form action={deleteMenuItem}>
                          <input
                            type="hidden"
                            name="restaurantId"
                            value={restaurant.id}
                          />
                          <input
                            type="hidden"
                            name="menuId"
                            value={defaultMenu.id}
                          />
                          <input type="hidden" name="itemId" value={item.id} />
                          <button
                            type="submit"
                            className="text-[11px] text-neutral-500 hover:text-red-600"
                          >
                            Remove
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}


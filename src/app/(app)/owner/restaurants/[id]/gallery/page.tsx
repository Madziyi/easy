import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RestaurantGalleryUploader } from "@/components/RestaurantGalleryUploader";
import { deleteGalleryImage } from "./actions";
import { getPublicImageUrl } from "@/lib/storage";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
};

type RestaurantRow = {
  id: string;
  name: string;
};

type ImageRow = {
  id: string;
  storage_path: string;
};

export default async function OwnerRestaurantGalleryPage({
  params,
  searchParams,
}: PageProps) {
  const [{ id: restaurantId }, sp] = await Promise.all([params, searchParams]);

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

  const [{ data: restaurant }, { data: images }] = await Promise.all([
    supabase
      .from("restaurants")
      .select("id, name")
      .eq("id", restaurantId)
      .maybeSingle<RestaurantRow>(),
    supabase
      .from("restaurant_images")
      .select("id, storage_path")
      .eq("restaurant_id", restaurantId)
      .order("position", { ascending: true })
      .limit(15) as unknown as { data: ImageRow[] | null },
  ]);

  if (!restaurant) {
    redirect("/owner");
  }

  const savedFlag = sp.saved === "1";
  const gallery = (images ?? []).map((img) => ({
    ...img,
    url: getPublicImageUrl("restaurants", img.storage_path),
  }));

  return (
    <main className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-xl font-semibold">Gallery – {restaurant.name}</h1>
        <p className="text-sm text-neutral-600">
          Upload photos of your space, dishes, and vibe. Up to 15 images total.
        </p>
      </section>

      {savedFlag && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Gallery updated.
        </div>
      )}

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
        <RestaurantGalleryUploader restaurantId={restaurant.id} />

        {gallery.length > 0 && (
          <div className="pt-4 border-t border-neutral-200 space-y-2">
            <p className="text-xs font-semibold text-neutral-700">
              Current gallery
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {gallery.map((img) =>
                img.url ? (
                  <div
                    key={img.id}
                    className="relative overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt="Gallery"
                      className="h-32 w-full object-cover"
                    />
                    <form
                      action={deleteGalleryImage}
                      className="absolute top-2 right-2"
                    >
                      <input
                        type="hidden"
                        name="restaurantId"
                        value={restaurant.id}
                      />
                      <input type="hidden" name="imageId" value={img.id} />
                      <button
                        type="submit"
                        className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-black/80"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                ) : null
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}



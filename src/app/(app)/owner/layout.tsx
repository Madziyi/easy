import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface OwnerLayoutProps {
  children: ReactNode;
}

export default async function OwnerLayout({ children }: OwnerLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login?next=/owner");
  }

  const supabase = await createSupabaseServerClient();

  const { data: memberRows, error } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role")
    .eq("user_id", user.id)
    .limit(1);

  if (error) {
    console.error("OwnerLayout restaurant_members error", error.message);
  }

  if (!memberRows || memberRows.length === 0) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">EasyEats for Restaurants</div>
            <div className="text-xs text-neutral-500">
              Manage your profile, menu, events & promotions.
            </div>
          </div>
          <div className="text-xs text-neutral-600 truncate max-w-[60%]">
            {user.email}
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}



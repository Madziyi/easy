import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface EasyLayoutProps {
  children: ReactNode;
}

export default async function EasyLayout({ children }: EasyLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login?next=/easy");
  }

  const supabase = await createSupabaseServerClient();

  const { data: appUser, error } = await supabase
    .from("app_users")
    .select("id, role, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("EasyLayout app_users error", error.message);
  }

  if (!appUser || !["ADMIN", "SUPERADMIN"].includes(appUser.role)) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-[#e81111]" />
            <div>
              <div className="text-sm font-semibold">EasyEats Console</div>
              <div className="text-xs text-neutral-500">Admin / Superadmin</div>
            </div>
          </div>
          <div className="text-xs text-neutral-600">
            {appUser.display_name || user.email}
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}



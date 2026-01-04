import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { OwnerUploadsPanel } from "./OwnerUploadsPanel";

export default async function OwnerUploadsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login?next=/owner/uploads");
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Temporary Upload Panel</h1>
        <p className="text-sm text-neutral-600">
          Use this page to test restaurant gallery and review image uploads.
          This panel is temporary and should be removed after testing.
        </p>
      </div>

      <OwnerUploadsPanel />
    </main>
  );
}



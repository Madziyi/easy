'use client';

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface MenuItemImageUploaderProps {
  restaurantId: string;
  menuItemId: string;
  hasImage: boolean;
}

export function MenuItemImageUploader({
  restaurantId,
  menuItemId,
  hasImage,
}: MenuItemImageUploaderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("restaurantId", restaurantId);
      formData.append("menuItemId", menuItemId);
      formData.append("file", file);

      const res = await fetch("/api/menu-item-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Upload failed");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error(err);
      setError("Could not upload image. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const label = hasImage ? "Change photo" : "Add photo";

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-600 hover:text-[#e81111] cursor-pointer">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-300">
          📷
        </span>
        <span>{label}</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
          disabled={uploading || isPending}
        />
      </label>
      {(uploading || isPending) && (
        <p className="text-[10px] text-neutral-500">Uploading…</p>
      )}
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}



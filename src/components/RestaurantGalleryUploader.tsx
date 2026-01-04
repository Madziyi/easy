'use client';

import { useState } from "react";

type Props = {
  restaurantId: string;
};

export function RestaurantGalleryUploader({ restaurantId }: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsUploading(true);

    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("files") as
      | HTMLInputElement
      | null;

    if (!fileInput || !fileInput.files?.length) {
      setError("Please select one or more images.");
      setIsUploading(false);
      return;
    }

    const data = new FormData();
    data.set("entityType", "restaurant_gallery");
    data.set("restaurantId", restaurantId);

    Array.from(fileInput.files).forEach((file) => {
      data.append("files", file);
    });

    const res = await fetch("/api/uploads/images", {
      method: "POST",
      body: data,
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Upload failed.");
      setIsUploading(false);
      return;
    }

    setSuccess(`Uploaded ${json.images?.length ?? 0} image(s).`);
    setIsUploading(false);
    fileInput.value = "";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-neutral-800">
          Add gallery photos
        </label>
        <input
          type="file"
          name="files"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-sm text-neutral-700 file:mr-4 file:rounded-full file:border-0 file:bg-red-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-red-700 hover:file:bg-red-100"
        />
        <p className="text-xs text-neutral-500">
          You can upload multiple images at once, up to 15 total for the
          gallery.
        </p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {success && <p className="text-xs text-emerald-600">{success}</p>}

      <button
        type="submit"
        disabled={isUploading}
        className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isUploading ? "Uploading..." : "Upload images"}
      </button>
    </form>
  );
}



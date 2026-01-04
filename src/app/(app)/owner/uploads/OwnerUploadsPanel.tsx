'use client';

import { useState } from "react";
import { RestaurantGalleryUploader } from "@/components/RestaurantGalleryUploader";
import { ReviewImagesUploader } from "@/components/ReviewImagesUploader";

export function OwnerUploadsPanel() {
  const [restaurantId, setRestaurantId] = useState("");
  const [reviewId, setReviewId] = useState("");

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Restaurant gallery test</h2>
        <p className="text-sm text-neutral-600 mb-4">
          Enter a restaurant ID you own/manage and upload gallery images (limit
          15 total per restaurant).
        </p>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-neutral-800">
            Restaurant ID
          </label>
          <input
            type="text"
            value={restaurantId}
            onChange={(e) => setRestaurantId(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
            placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
          />
          {restaurantId ? (
            <RestaurantGalleryUploader restaurantId={restaurantId} />
          ) : (
            <p className="text-xs text-neutral-500">
              Provide a restaurant ID to enable uploads.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Review images test</h2>
        <p className="text-sm text-neutral-600 mb-4">
          Enter a review ID (you must be the author) and upload up to 5 images
          for that review.
        </p>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-neutral-800">
            Review ID
          </label>
          <input
            type="text"
            value={reviewId}
            onChange={(e) => setReviewId(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
            placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
          />
          {reviewId ? (
            <ReviewImagesUploader reviewId={reviewId} />
          ) : (
            <p className="text-xs text-neutral-500">
              Provide a review ID to enable uploads.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}



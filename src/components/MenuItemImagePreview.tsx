'use client';

import { useState } from "react";

interface MenuItemImagePreviewProps {
  imageUrl: string | null;
}

export function MenuItemImagePreview({
  imageUrl,
}: MenuItemImagePreviewProps) {
  const [open, setOpen] = useState(false);

  if (!imageUrl) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-[#e81111]"
      >
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-300">
          📷
        </span>
        <span>Photo</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative max-h-[80vh] max-w-[90vw] overflow-hidden rounded-2xl bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Menu item"
              className="max-h-[80vh] max-w-[90vw] object-contain"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium text-white hover:bg-black/80"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}



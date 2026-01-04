export type SourceRating = {
  rating: number | null; // 0–5 or null if unknown
  count: number | null; // number of reviews, or null if unknown
};

export type CombinedRatingResult = {
  combinedRating: number | null; // null => "No ratings yet"
  totalCount: number;
  sourceCounts: {
    google: number;
    tripadvisor: number;
    easyeats: number;
  };
};

/**
 * Weighted average of up to three sources:
 *  - Google
 *  - Tripadvisor
 *  - EasyEats
 *
 * Formula:
 *   R_combined = (Rg*Ng + Rt*Nt + Re*Ne) / (Ng + Nt + Ne)
 *
 * Edge cases:
 *  - If rating is null or count <= 0, that source is ignored (N=0).
 *  - If total N = 0, combinedRating = null.
 */
export function computeCombinedRating(
  google: SourceRating,
  tripadvisor: SourceRating,
  easyeats: SourceRating
): CombinedRatingResult {
  const Ng =
    google.rating != null && google.count != null && google.count > 0
      ? google.count
      : 0;

  const Nt =
    tripadvisor.rating != null &&
    tripadvisor.count != null &&
    tripadvisor.count > 0
      ? tripadvisor.count
      : 0;

  const Ne =
    easyeats.rating != null && easyeats.count != null && easyeats.count > 0
      ? easyeats.count
      : 0;

  const total = Ng + Nt + Ne;

  if (total === 0) {
    return {
      combinedRating: null,
      totalCount: 0,
      sourceCounts: {
        google: 0,
        tripadvisor: 0,
        easyeats: 0,
      },
    };
  }

  const sum =
    (google.rating ?? 0) * Ng +
    (tripadvisor.rating ?? 0) * Nt +
    (easyeats.rating ?? 0) * Ne;

  const combined = sum / total;

  return {
    combinedRating: combined,
    totalCount: total,
    sourceCounts: {
      google: Ng,
      tripadvisor: Nt,
      easyeats: Ne,
    },
  };
}



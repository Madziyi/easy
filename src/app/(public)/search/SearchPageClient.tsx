'use client';

import * as React from "react";
import { useRouter } from "next/navigation";

type CuisineRow = {
  id: number;
  slug: string;
  name: string;
  category: string | null;
  sort_order: number;
};

type FeatureRow = {
  id: number;
  slug: string;
  name: string;
  category: string | null;
  icon_key: string | null;
  sort_order: number;
};

type SearchResult = {
  restaurant_id: string;
  slug: string;
  name: string;
  city: string | null;
  description: string | null;
  cuisines: string[] | null;
  features: string[] | null;
  highlight: string | null;
  highlight_source: string | null;
  rank: number;
};

type Suggestion = {
  id: number;
  term: string;
  kind: "restaurant" | "dish" | "area" | "query";
  restaurant_id: string | null;
  menu_item_id: string | null;
  popularity_score: number;
};

interface SearchPageClientProps {
  initialQuery: string;
  initialCity: string;
  cuisines: CuisineRow[];
  features: FeatureRow[];
}

const ACCENT = "#e81111";

export default function SearchPageClient(props: SearchPageClientProps) {
  const { initialQuery, initialCity, cuisines, features } = props;
  const router = useRouter();

  const [query, setQuery] = React.useState(initialQuery);
  const [city, setCity] = React.useState(initialCity);
  const [selectedCuisineSlugs, setSelectedCuisineSlugs] = React.useState<
    string[]
  >([]);
  const [selectedFeatureSlugs, setSelectedFeatureSlugs] = React.useState<
    string[]
  >([]);

  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  const [error, setError] = React.useState<string | null>(null);

  const featuresByCategory = React.useMemo(() => {
    return features.reduce<Record<string, FeatureRow[]>>((acc, f) => {
      const key = f.category || "other";
      if (!acc[key]) acc[key] = [];
      acc[key].push(f);
      return acc;
    }, {});
  }, [features]);

  const featureCategoryLabel = (key: string): string => {
    switch (key) {
      case "dietary":
        return "Dietary options";
      case "amenity":
        return "Amenities";
      case "services":
        return "Services";
      case "atmosphere":
        return "Atmosphere";
      case "bar":
        return "Bar & drinks";
      default:
        return key.replace(/-/g, " ");
    }
  };

  React.useEffect(() => {
    const qTrim = query.trim();

    if (!qTrim) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const baseSuggestion: Suggestion = {
      id: -1,
      term: qTrim,
      kind: "query",
      restaurant_id: null,
      menu_item_id: null,
      popularity_score: Number.MAX_SAFE_INTEGER,
    };

    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/suggestions?q=${encodeURIComponent(qTrim)}`
        );
        if (!res.ok) throw new Error("Failed to load suggestions");
        const data = (await res.json()) as { suggestions: Suggestion[] };
        if (!cancelled) {
          const incoming = data.suggestions ?? [];
          const merged = [
            baseSuggestion,
            ...incoming.filter(
              (s) => s.term.toLowerCase() !== qTrim.toLowerCase()
            ),
          ];
          setSuggestions(merged);
          setShowSuggestions(true);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([baseSuggestion]);
          setShowSuggestions(true);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  const performSearch = React.useCallback(
    async (opts?: { replaceUrlOnly?: boolean }) => {
      const qTrim = query.trim();
      const params = new URLSearchParams();

      if (qTrim) params.set("q", qTrim);
      if (city.trim()) params.set("city", city.trim());
      selectedCuisineSlugs.forEach((slug) => params.append("cuisines", slug));
      selectedFeatureSlugs.forEach((slug) => params.append("features", slug));

      const url = params.toString() ? `/search?${params.toString()}` : "/search";

      if (opts?.replaceUrlOnly) {
        router.replace(url);
        return;
      }

      setIsSearching(true);
      setError(null);
      setShowSuggestions(false);

      try {
        router.replace(url);
        const res = await fetch(`/api/search?${params.toString()}`);
        if (!res.ok) {
          throw new Error("Search failed");
        }
        const data = (await res.json()) as { results: SearchResult[] };
        setResults(data.results ?? []);
      } catch {
        setError("Something went wrong while searching.");
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [query, city, selectedCuisineSlugs, selectedFeatureSlugs, router]
  );

  React.useEffect(() => {
    if (initialQuery && !results.length) {
      void performSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void performSearch();
  };

  const toggleCuisine = (slug: string) => {
    setSelectedCuisineSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const toggleFeature = (slug: string) => {
    setSelectedFeatureSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const applySuggestion = (s: Suggestion) => {
    setQuery(s.term);
    setShowSuggestions(false);
    void performSearch();
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Search restaurants & dishes
        </h1>
        <p className="text-sm text-neutral-600">
          Search by restaurant name, dish, or keywords from menus and reviews.
        </p>

        <form
          onSubmit={onSubmit}
          className="relative flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                }}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 150);
                }}
                placeholder='Try “Mama’s Grill” or “beef stew”'
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[color:var(--accent-color,#e81111)] focus:ring-1 focus:ring-[color:var(--accent-color,#e81111)]"
                style={
                  {
                    "--accent-color": ACCENT,
                  } as React.CSSProperties
                }
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
                  <ul className="max-h-64 divide-y divide-neutral-100 overflow-auto text-sm">
                    {suggestions.map((s) => (
                      <li
                        key={s.id}
                        className="cursor-pointer px-3 py-2 hover:bg-neutral-50"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applySuggestion(s);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-neutral-900">
                            {s.term}
                          </span>
                          <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                            {s.kind === "restaurant"
                              ? "Restaurant"
                              : s.kind === "dish"
                              ? "Dish"
                              : "Search"}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 md:w-56">
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City (optional)"
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[color:var(--accent-color,#e81111)] focus:ring-1 focus:ring-[color:var(--accent-color,#e81111)]"
                style={
                  {
                    "--accent-color": ACCENT,
                  } as React.CSSProperties
                }
              />
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="inline-flex items-center justify-center rounded-xl bg-[color:var(--accent-color,#e81111)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={
                {
                  "--accent-color": ACCENT,
                } as React.CSSProperties
              }
            >
              {isSearching ? "Searching…" : "Search"}
            </button>
          </div>

          {cuisines.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {cuisines.map((c) => {
                const active = selectedCuisineSlugs.includes(c.slug);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCuisine(c.slug)}
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                      active
                        ? "border-[color:var(--accent-color,#e81111)] bg-[color:var(--accent-soft,#fde4e4)] text-neutral-900"
                        : "border-neutral-200 bg-neutral-50 text-neutral-800 hover:border-neutral-300"
                    }`}
                    style={
                      {
                        "--accent-color": ACCENT,
                        "--accent-soft": "#fde4e4",
                      } as React.CSSProperties
                    }
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}

          {Object.keys(featuresByCategory).length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Features
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(featuresByCategory).map(([categoryKey, list]) =>
                  list.map((f) => {
                    const active = selectedFeatureSlugs.includes(f.slug);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => toggleFeature(f.slug)}
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                          active
                            ? "border-[color:var(--accent-color,#e81111)] bg-[color:var(--accent-soft,#fde4e4)] text-neutral-900"
                            : "border-neutral-200 bg-neutral-50 text-neutral-800 hover:border-neutral-300"
                        }`}
                        style={
                          {
                            "--accent-color": ACCENT,
                            "--accent-soft": "#fde4e4",
                          } as React.CSSProperties
                        }
                        title={featureCategoryLabel(categoryKey)}
                      >
                        {f.name}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </form>
      </section>

      <section className="space-y-3">
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!isSearching && query.trim() && results.length === 0 && !error && (
          <p className="text-sm text-neutral-600">
            No results found. Try adjusting your search or filters.
          </p>
        )}

        {results.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-neutral-500">
              Showing {results.length} result
              {results.length === 1 ? "" : "s"}
            </p>
            <ul className="space-y-3">
              {results.map((r) => (
                <li
                  key={r.restaurant_id}
                  className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <a href={`/restaurants/${r.slug}`} className="block space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h2 className="text-base font-semibold text-neutral-900">
                          {r.name}
                        </h2>
                        <p className="text-xs text-neutral-500">
                          {r.city}
                          {r.highlight_source
                            ? ` · Found in ${r.highlight_source}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    {r.highlight && (
                      <p
                        className="text-sm text-neutral-700"
                        dangerouslySetInnerHTML={{
                          __html: r.highlight,
                        }}
                      />
                    )}

                    {r.cuisines && r.cuisines.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {r.cuisines.map((slug) => (
                          <span
                            key={slug}
                            className="inline-flex items-center rounded-full bg-neutral-50 px-2.5 py-0.5 text-[11px] text-neutral-700 border border-neutral-200"
                          >
                            {slug.replace(/-/g, " ")}
                          </span>
                        ))}
                      </div>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isSearching && (
          <p className="text-sm text-neutral-600">Searching…</p>
        )}
      </section>
    </div>
  );
}


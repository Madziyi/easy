'use client';

import * as React from "react";
import { useRouter } from "next/navigation";
import DOMPurify from "isomorphic-dompurify";

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
  restaurant_name: string;
  restaurant_slug: string;
  name: string;
  city: string | null;
  highlight: string | null;
  highlight_source: string | null;
};

type Suggestion = {
  id: string;
  term: string;
  kind: "restaurant" | "dish" | "review" | "query";
  restaurant_id: string | null;
  restaurant_slug: string | null;
  restaurant_name: string | null;
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
  const [selectedCuisineSlugs, setSelectedCuisineSlugs] = React.useState<string[]>([]);
  const [selectedFeatureSlugs, setSelectedFeatureSlugs] = React.useState<string[]>([]);
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Suggested highlight categories mapping
  const featureCategoryLabel = (key: string): string => {
    const labels: Record<string, string> = {
      dietary: "Dietary options",
      amenity: "Amenities",
      services: "Services",
      atmosphere: "Atmosphere",
      bar: "Bar & drinks"
    };
    return labels[key] || key.replace(/-/g, " ");
  };

  // Suggestions debounced fetch
  React.useEffect(() => {
    const qTrim = query.trim();
    if (!qTrim) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const baseQuerySuggestion: Suggestion = {
      id: "query",
      term: qTrim,
      kind: "query",
      restaurant_id: null,
      restaurant_slug: null,
      restaurant_name: null
    };

    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(qTrim)}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) {
          const filtered = (data.suggestions || []).filter((s: Suggestion) => s.term.toLowerCase() !== qTrim.toLowerCase());
          setSuggestions([baseQuerySuggestion, ...filtered]);
          setShowSuggestions(true);
        }
      } catch {
        if (!cancelled) setSuggestions([baseQuerySuggestion]);
      }
    }, 200);

    return () => { cancelled = true; clearTimeout(handle); };
  }, [query]);

  const performSearch = React.useCallback(async () => {
    const qTrim = query.trim();
    const params = new URLSearchParams();
    if (qTrim) params.set("q", qTrim);
    if (city.trim()) params.set("city", city.trim());
    selectedCuisineSlugs.forEach(s => params.append("cuisines", s));
    selectedFeatureSlugs.forEach(s => params.append("features", s));

    setIsSearching(true);
    setError(null);
    setShowSuggestions(false);

    try {
      router.replace(params.toString() ? `/search?${params.toString()}` : "/search");
      const res = await fetch(`/api/search?${params.toString()}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setError("Something went wrong while searching.");
    } finally {
      setIsSearching(false);
    }
  }, [query, city, selectedCuisineSlugs, selectedFeatureSlugs, router]);

  const applySuggestion = (s: Suggestion) => {
    if (s.restaurant_slug && s.kind !== 'query') {
      router.push(`/restaurants/${s.restaurant_slug}`);
      return;
    }
    setQuery(s.term);
    setShowSuggestions(false);
    void performSearch();
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Search restaurants & dishes</h1>
        <p className="text-sm text-neutral-600">Find top-rated spots by name, menu items, or local reviews.</p>

        <form onSubmit={(e) => { e.preventDefault(); void performSearch(); }} className="relative flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder='Try “Mama’s Grill” or “beef stew”'
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#e81111] focus:border-[#e81111]"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
                  <ul className="max-h-64 divide-y divide-neutral-100 overflow-auto text-sm">
                    {suggestions.map((s) => (
                      <li key={s.id} className="cursor-pointer px-3 py-2 hover:bg-neutral-50" onMouseDown={(e) => { e.preventDefault(); applySuggestion(s); }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-neutral-900">{s.term}</span>
                          <span className="text-[10px] uppercase font-bold text-neutral-400">{s.kind}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="md:w-56 rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none" />
            <button type="submit" disabled={isSearching} className="bg-[#e81111] px-6 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {isSearching ? "..." : "Search"}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        {results.length > 0 && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold">Results ({results.length})</p>
            <ul className="space-y-3">
              {results.map((r) => (
                <li key={r.restaurant_id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm hover:shadow-md transition cursor-pointer">
                  <a href={`/restaurants/${r.restaurant_slug}`} className="block space-y-2">
                    <h2 className="text-base font-bold text-neutral-900">{r.restaurant_name}</h2>
                    <p className="text-xs text-neutral-500">{r.city} {r.highlight_source && `• Match in ${r.highlight_source}`}</p>
                    
                    {r.highlight && (
                      <p className="text-sm text-neutral-600 leading-relaxed" 
                        dangerouslySetInnerHTML={{ 
                          __html: DOMPurify.sanitize(r.highlight, { ALLOWED_TAGS: ["mark"] }) 
                        }} 
                      />
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!isSearching && query && results.length === 0 && <p className="text-center py-10 text-neutral-500">No matches found for "{query}"</p>}
      </section>
    </div>
  );
}
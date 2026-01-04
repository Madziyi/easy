import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);

  const q = url.searchParams.get("q") ?? "";
  const city = url.searchParams.get("city");
  const cuisines = url.searchParams.getAll("cuisines");
  const features = url.searchParams.getAll("features");

  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 20;
  const offset = Number.isFinite(offsetRaw) ? offsetRaw : 0;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("search_restaurants", {
    q_input: q,
    city_input: city,
    cuisine_slugs_input: cuisines.length ? cuisines : null,
    feature_slugs_input: features.length ? features : null,
    limit_input: limit,
    offset_input: offset,
  });

  if (error) {
    console.error("search_restaurants error", error.message);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }

  const normalizedQuery = q.trim().toLowerCase();

  const escapeHtml = (input: string) =>
    input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const buildHighlight = (
    text: string | null | undefined,
    source: string
  ): { snippet: string; source: string } | null => {
    if (!normalizedQuery || !text) return null;
    const lowerText = text.toLowerCase();
    const idx = lowerText.indexOf(normalizedQuery);
    if (idx === -1) return null;

    const start = Math.max(0, idx - 32);
    const end = Math.min(text.length, idx + normalizedQuery.length + 32);

    const before = escapeHtml(text.slice(start, idx));
    const match = escapeHtml(
      text.slice(idx, idx + normalizedQuery.length) || normalizedQuery
    );
    const after = escapeHtml(text.slice(idx + normalizedQuery.length, end));

    const prefix = start > 0 ? "..." : "";
    const suffix = end < text.length ? "..." : "";

    return {
      snippet: `${prefix}${before}<mark>${match}</mark>${after}${suffix}`,
      source,
    };
  };

  const resultsWithHighlight = (data ?? []).map((row) => {
    const result = row as {
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

    if (result.highlight) return result;

    const candidates: { text: string | null | undefined; source: string }[] = [
      { text: result.description, source: "description" },
      { text: result.name, source: "name" },
    ];

    if (Array.isArray(result.cuisines) && result.cuisines.length) {
      candidates.push({
        text: result.cuisines.join(", "),
        source: "cuisines",
      });
    }

    if (Array.isArray(result.features) && result.features.length) {
      candidates.push({
        text: result.features.join(", "),
        source: "features",
      });
    }

    for (const candidate of candidates) {
      const built = buildHighlight(candidate.text, candidate.source);
      if (built) {
        return {
          ...result,
          highlight: built.snippet,
          highlight_source: candidate.source,
        };
      }
    }

    return result;
  });

  return NextResponse.json({
    results: resultsWithHighlight as {
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
    }[],
  });
}


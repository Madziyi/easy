import { NextResponse } from "next/server";
import { typesenseClient } from "@/lib/typesense";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ suggestions: [] });

  try {
    const results = await typesenseClient.collections("easy_eats_search").documents().search({
      q,
      query_by: "name",
      filter_by: "record_type:=[restaurant, dish] && status:=[PUBLISHED]",
      prefix: true,
      per_page: 8
    });

    const suggestions = results.hits?.map((hit: any) => ({
      id: hit.document.id,
      term: hit.document.name,
      kind: hit.document.record_type,
      restaurant_id: hit.document.restaurant_id,
      restaurant_slug: hit.document.restaurant_slug,
      restaurant_name: hit.document.restaurant_name
    }));

    return NextResponse.json({ suggestions });
  } catch (e) { return NextResponse.json({ suggestions: [] }); }
}
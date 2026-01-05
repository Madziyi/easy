import { NextResponse } from "next/server";
import { typesenseClient } from "@/lib/typesense";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "*";
  
  try {
    const searchResults = await typesenseClient.collections("easy_eats_search").documents().search({
      q,
      query_by: "name,content",
      group_by: "restaurant_id",
      group_limit: 1,
      highlight_full_fields: "name,content",
      filter_by: "status:=[PUBLISHED]"
    });

    const results = searchResults.grouped_hits?.map((group: any) => {
      const hit = group.hits[0];
      return {
        restaurant_id: group.group_key[0],
        restaurant_name: hit.document.restaurant_name,
        restaurant_slug: hit.document.restaurant_slug,
        name: hit.document.name,
        city: hit.document.city || null,
        highlight: hit.highlights?.[0]?.snippet || null,
        highlight_source: hit.highlights?.[0]?.field || null,
      };
    }) || [];

    return NextResponse.json({ results });
  } catch (error) { return NextResponse.json({ error: "Search failed" }, { status: 500 }); }
}
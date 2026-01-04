import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("q") ?? "";
  const q = raw.trim();

  if (!q) {
    return NextResponse.json({ suggestions: [] });
  }

  const norm = q.toLowerCase();

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("search_suggestions")
    .select("id, term, kind, restaurant_id, menu_item_id, popularity_score")
    .ilike("normalized_term", `${norm}%`)
    .order("popularity_score", { ascending: false })
    .limit(8);

  if (error) {
    console.error("search suggestions error", error.message);
    return NextResponse.json({ suggestions: [] }, { status: 500 });
  }

  return NextResponse.json({
    suggestions: (data ?? []) as {
      id: number;
      term: string;
      kind: "restaurant" | "dish" | "area" | "query";
      restaurant_id: string | null;
      menu_item_id: string | null;
      popularity_score: number;
    }[],
  });
}


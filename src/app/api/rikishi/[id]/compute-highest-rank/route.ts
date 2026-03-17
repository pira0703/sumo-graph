import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// rank_class の強さ順（index が小さいほど上位）
const RANK_ORDER = [
  "yokozuna", "ozeki", "sekiwake", "komusubi",
  "maegashira", "juryo", "makushita",
  "sandanme", "jonidan", "jonokuchi",
] as const;
type RankClass = (typeof RANK_ORDER)[number];

// GET /api/rikishi/[id]/compute-highest-rank
// banzuke テーブルから最高位を算出して返す（更新はしない）
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("banzuke")
    .select("rank_class")
    .eq("rikishi_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ highest_rank: null, message: "番付データがありません" });
  }

  const highest = data.reduce<RankClass>((best, entry) => {
    const idx = RANK_ORDER.indexOf(entry.rank_class as RankClass);
    const bestIdx = RANK_ORDER.indexOf(best);
    return idx !== -1 && idx < bestIdx ? (entry.rank_class as RankClass) : best;
  }, "jonokuchi");

  return NextResponse.json({ highest_rank: highest });
}

// POST /api/rikishi/[id]/compute-highest-rank
// banzuke から最高位を算出して rikishi テーブルを更新する
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("banzuke")
    .select("rank_class")
    .eq("rikishi_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "番付データがありません" }, { status: 404 });
  }

  const highest = data.reduce<RankClass>((best, entry) => {
    const idx = RANK_ORDER.indexOf(entry.rank_class as RankClass);
    const bestIdx = RANK_ORDER.indexOf(best);
    return idx !== -1 && idx < bestIdx ? (entry.rank_class as RankClass) : best;
  }, "jonokuchi");

  const { error: updateErr } = await supabase
    .from("rikishi")
    .update({ highest_rank: highest })
    .eq("id", id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json({ highest_rank: highest });
}

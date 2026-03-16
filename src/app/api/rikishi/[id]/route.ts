import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// 更新を許可するカラム一覧
const ALLOWED_FIELDS = [
  "shikona", "yomigana", "real_name", "heya_id", "born_place", "birth_date",
  "highest_rank", "active_from_basho", "retirement_basho", "nationality", "high_school", "university",
  "episodes", "photo_url", "wiki_url", "shisho_id",
  "oyakata_id",
  // migration_retirement_oyakata_history.sql で追加
  "status", "heya_role",
] as const;

/** PUT /api/rikishi/[id]
 * 力士情報を更新する（部分更新: body に含まれるフィールドのみ上書き）
 * 引退処理: status='retired' + retirement_basho で管理
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const body: Record<string, unknown> = await req.json();

  // 許可フィールドだけ抽出
  const updateData: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      updateData[key] = body[key];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "更新するフィールドがありません" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("rikishi")
    .update(updateData)
    .eq("id", id)
    .select("*, heya(name, ichimon)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: rikishi, error: rErr } = await supabase
    .from("rikishi")
    .select("*, heya(name, ichimon)")
    .eq("id", id)
    .single();

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 404 });

  const { data: relA } = await supabase
    .from("relationships")
    .select("*, rikishi_b:rikishi_b_id(id, shikona, highest_rank, photo_url)")
    .eq("rikishi_a_id", id);

  const { data: relB } = await supabase
    .from("relationships")
    .select("*, rikishi_a:rikishi_a_id(id, shikona, highest_rank, photo_url)")
    .eq("rikishi_b_id", id);

  // 現役力士の場合、最新 banzuke を取得して現在番付を付加
  let currentBanzuke: { basho: string; rank_class: string; rank_number: number | null; rank_side: string | null; rank_display: string | null } | null = null;
  if (rikishi.status !== "retired") {
    const { data: bzRow } = await supabase
      .from("banzuke")
      .select("basho, rank_class, rank_number, rank_side, rank_display")
      .eq("rikishi_id", id)
      .order("basho", { ascending: false })
      .limit(1)
      .maybeSingle();
    currentBanzuke = bzRow ?? null;
  }

  return NextResponse.json({
    rikishi: { ...rikishi, current_banzuke: currentBanzuke },
    relationships: [...(relA ?? []), ...(relB ?? [])],
  });
}

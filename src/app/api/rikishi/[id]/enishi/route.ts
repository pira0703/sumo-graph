import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

interface Params { params: Promise<{ id: string }> }

/**
 * GET /api/rikishi/[id]/enishi
 * この力士が参加しているえにし一覧（全メンバー付き）
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();

  // この力士が属する enishi_id を取得
  const { data: myRows, error: e1 } = await supabase
    .from("enishi_members")
    .select("enishi_id")
    .eq("rikishi_id", id);

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  if (!myRows || myRows.length === 0) return NextResponse.json([]);

  const enishiIds = myRows.map((r) => r.enishi_id);

  // enishi 本体を取得
  const { data: enishiList, error: e2 } = await supabase
    .from("enishi")
    .select("id, relation_type, description, created_at")
    .in("id", enishiIds)
    .order("created_at", { ascending: false });

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  // 全メンバー情報を取得
  const { data: memberRows, error: e3 } = await supabase
    .from("enishi_members")
    .select("enishi_id, rikishi_id, rikishi:rikishi_id(id, shikona, photo_url, status)")
    .in("enishi_id", enishiIds);

  if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });

  type MemberRaw = { id: string; shikona: string; photo_url: string | null; status: string };

  // enishi ごとにメンバーをグループ化
  const membersByEnishi = new Map<string, { rikishi_id: string; shikona: string; photo_url: string | null; status: string }[]>();
  for (const m of memberRows ?? []) {
    if (!membersByEnishi.has(m.enishi_id)) membersByEnishi.set(m.enishi_id, []);
    const r = (m.rikishi as unknown) as MemberRaw | null;
    if (r) membersByEnishi.get(m.enishi_id)!.push({
      rikishi_id: r.id,
      shikona:    r.shikona,
      photo_url:  r.photo_url,
      status:     r.status,
    });
  }

  const result = (enishiList ?? []).map((e) => ({
    id:            e.id,
    relation_type: e.relation_type,
    description:   e.description,
    created_at:    e.created_at,
    members:       membersByEnishi.get(e.id) ?? [],
  }));

  return NextResponse.json(result);
}

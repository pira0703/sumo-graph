import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/**
 * POST /api/enishi
 * えにしグループを新規作成
 * body: { relation_type: string, description?: string, member_ids: string[] }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const relation_type = (body.relation_type ?? "").trim();
  const description   = (body.description   ?? "").trim() || null;
  const member_ids: string[] = body.member_ids ?? [];

  if (!relation_type) {
    return NextResponse.json({ error: "縁の種別は必須です" }, { status: 400 });
  }
  if (member_ids.length < 2) {
    return NextResponse.json({ error: "メンバーは2名以上必要です" }, { status: 400 });
  }
  if (new Set(member_ids).size !== member_ids.length) {
    return NextResponse.json({ error: "同じ力士が重複しています" }, { status: 400 });
  }

  const supabase = createServerClient();

  // enishi 本体を作成
  const { data: enishi, error: e1 } = await supabase
    .from("enishi")
    .insert({ relation_type, description })
    .select("id")
    .single();

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  // メンバーを一括挿入
  const { error: e2 } = await supabase
    .from("enishi_members")
    .insert(member_ids.map((rikishi_id) => ({ enishi_id: enishi.id, rikishi_id })));

  if (e2) {
    // ロールバック相当: enishi 本体を削除
    await supabase.from("enishi").delete().eq("id", enishi.id);
    return NextResponse.json({ error: e2.message }, { status: 500 });
  }

  return NextResponse.json({ id: enishi.id }, { status: 201 });
}

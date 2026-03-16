import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/** GET /api/rikishi/[id]/oyakata-history
 * 名跡保有履歴一覧（新しい順）
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("oyakata_name_history")
    .select("*, oyakata_master(name, yomigana, ichimon)")
    .eq("rikishi_id", id)
    .order("start_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ history: data ?? [] });
}

/** POST /api/rikishi/[id]/oyakata-history
 * 名跡取得（新規エントリ追加）
 * body: { oyakata_master_id, start_date, reason?, notes? }
 *
 * ⚠️ rikishi.oyakata_id の更新は呼び出し元（PUT /api/rikishi/[id]）で別途行う
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const body: {
    oyakata_master_id: string;
    start_date: string;
    reason?: string;
    notes?: string;
  } = await req.json();

  if (!body.oyakata_master_id || !body.start_date) {
    return NextResponse.json(
      { error: "oyakata_master_id と start_date は必須です" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("oyakata_name_history")
    .insert({
      rikishi_id:        id,
      oyakata_master_id: body.oyakata_master_id,
      start_date:        body.start_date,
      reason:            body.reason  ?? null,
      notes:             body.notes   ?? null,
    })
    .select("*, oyakata_master(name, yomigana, ichimon)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

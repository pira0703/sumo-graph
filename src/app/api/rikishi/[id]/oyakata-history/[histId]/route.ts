import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/** PATCH /api/rikishi/[id]/oyakata-history/[histId]
 * 既存エントリの更新（名跡終了・理由修正など）
 * body: { end_date?, reason?, notes? }
 *
 * 主な用途:
 *   名跡終了: { end_date: "2025-01-01", reason: "定年返上" }
 *   名跡移転（旧を閉じる): { end_date: "2025-01-01", reason: "名跡移転" }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; histId: string }> }
) {
  const { id, histId } = await params;
  const supabase = createServerClient();

  const body: { end_date?: string; reason?: string; notes?: string } =
    await req.json();

  const updateData: Record<string, unknown> = {};
  if (Object.prototype.hasOwnProperty.call(body, "end_date"))  updateData.end_date = body.end_date ?? null;
  if (Object.prototype.hasOwnProperty.call(body, "reason"))    updateData.reason   = body.reason   ?? null;
  if (Object.prototype.hasOwnProperty.call(body, "notes"))     updateData.notes    = body.notes    ?? null;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "更新フィールドがありません" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("oyakata_name_history")
    .update(updateData)
    .eq("id", histId)
    .eq("rikishi_id", id)  // 他人のレコードを誤更新しないように
    .select("*, oyakata_master(name, yomigana, ichimon)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

/** DELETE /api/rikishi/[id]/oyakata-history/[histId]
 * 誤登録したエントリを削除する（慎重に使う）
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; histId: string }> }
) {
  const { id, histId } = await params;
  const supabase = createServerClient();

  const { error } = await supabase
    .from("oyakata_name_history")
    .delete()
    .eq("id", histId)
    .eq("rikishi_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

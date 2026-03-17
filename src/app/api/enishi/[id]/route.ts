import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

interface Params { params: Promise<{ id: string }> }

/**
 * GET /api/enishi/[id]
 * えにし詳細（メンバー付き）
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: enishi, error: e1 } = await supabase
    .from("enishi")
    .select("id, relation_type, description, created_at")
    .eq("id", id)
    .single();

  if (e1) return NextResponse.json({ error: e1.message }, { status: 404 });

  const { data: memberRows, error: e2 } = await supabase
    .from("enishi_members")
    .select("rikishi_id, rikishi:rikishi_id(id, shikona, photo_url, status)")
    .eq("enishi_id", id);

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  type MemberRaw = { id: string; shikona: string; photo_url: string | null; status: string };
  const members = (memberRows ?? []).map((m) => {
    const r = (m.rikishi as unknown) as MemberRaw | null;
    return r ? { rikishi_id: r.id, shikona: r.shikona, photo_url: r.photo_url, status: r.status } : null;
  }).filter(Boolean);

  return NextResponse.json({ ...enishi, members });
}

/**
 * DELETE /api/enishi/[id]
 * えにし削除（メンバーはカスケード削除）
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();

  const { error } = await supabase.from("enishi").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/enishi/[id]/members
 * メンバー追加: body { rikishi_id: string }
 * メンバー削除: ?rikishi_id=xxx
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const url = new URL(req.url);
  const action = url.searchParams.get("action"); // "add" | "remove"
  const body = await req.json().catch(() => ({}));
  const rikishi_id = (body.rikishi_id ?? url.searchParams.get("rikishi_id") ?? "").trim();

  if (!rikishi_id) return NextResponse.json({ error: "rikishi_id は必須です" }, { status: 400 });

  const supabase = createServerClient();

  if (action === "remove") {
    const { error } = await supabase
      .from("enishi_members")
      .delete()
      .eq("enishi_id", id)
      .eq("rikishi_id", rikishi_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // default: add
  const { error } = await supabase
    .from("enishi_members")
    .insert({ enishi_id: id, rikishi_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

interface Params { params: Promise<{ id: string }> }

// GET /api/rikishi/[id]/shisho-history
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("rikishi_shisho")
    .select("id, rikishi_id, shisho_id, from_basho, to_basho, notes, created_at, shisho:shisho_id(id, shikona, photo_url)")
    .eq("rikishi_id", id)
    .order("from_basho", { ascending: false });

  if (error) {
    // テーブルが未作成の場合は空配列を返す
    if (error.code === "42P01") return NextResponse.json({ shishoHistory: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ shishoHistory: data ?? [] });
}

// POST /api/rikishi/[id]/shisho-history
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const shisho_id  = (body.shisho_id  ?? "").trim();
  const from_basho = (body.from_basho ?? "").trim() || null;
  const to_basho   = (body.to_basho   ?? "").trim() || null;
  const notes      = (body.notes      ?? "").trim() || null;

  if (!shisho_id) return NextResponse.json({ error: "師匠IDは必須です" }, { status: 400 });
  if (shisho_id === id) return NextResponse.json({ error: "自分自身を師匠にはできません" }, { status: 400 });

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("rikishi_shisho")
    .insert({ rikishi_id: id, shisho_id, from_basho, to_basho, notes })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // rikishi.shisho_id（現在の師匠）も更新
  if (!to_basho) {
    await supabase.from("rikishi").update({ shisho_id }).eq("id", id);
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}

// DELETE /api/rikishi/[id]/shisho-history?hist_id=xxx
export async function DELETE(req: NextRequest, { params }: Params) {
  await params;
  const hist_id = new URL(req.url).searchParams.get("hist_id");
  if (!hist_id) return NextResponse.json({ error: "hist_id は必須です" }, { status: 400 });

  const supabase = createServerClient();
  const { error } = await supabase.from("rikishi_shisho").delete().eq("id", hist_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

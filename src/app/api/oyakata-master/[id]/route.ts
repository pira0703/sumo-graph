import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// GET /api/oyakata-master/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("oyakata_master")
    .select("id, name, yomigana, ichimon, is_ichidai_toshiyori, notes")
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

// PUT /api/oyakata-master/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "名跡名は必須です" }, { status: 400 });
  }

  const supabase = createServerClient();
  const updateData: Record<string, unknown> = {
    name,
    yomigana:             body.yomigana             ? body.yomigana.trim() : null,
    ichimon:              body.ichimon              ?? null,
    is_ichidai_toshiyori: body.is_ichidai_toshiyori === true,
    notes:                body.notes               ? body.notes.trim()    : null,
  };

  const { error } = await supabase
    .from("oyakata_master")
    .update(updateData)
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "同名の名跡がすでに存在します" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// DELETE /api/oyakata-master/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();
  const { error } = await supabase.from("oyakata_master").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// GET /api/basho/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("basho")
    .select("id, name, short_name, location, start_date, end_date")
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

// PUT /api/basho/[id]  — id は変更不可
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const supabase = createServerClient();
  const updateData: Record<string, unknown> = {
    name:       body.name       ? (body.name       as string).trim() : null,
    short_name: body.short_name ? (body.short_name as string).trim() : null,
    location:   body.location   ? (body.location   as string).trim() : null,
    start_date: body.start_date ?? null,
    end_date:   body.end_date   ?? null,
  };

  const { error } = await supabase
    .from("basho")
    .update(updateData)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/basho/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  // 番付エントリの存在チェック
  const { count } = await supabase
    .from("banzuke")
    .select("id", { count: "exact", head: true })
    .eq("basho_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `この場所には ${count} 件の番付データがあります。先に番付データを削除してください。` },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("basho").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

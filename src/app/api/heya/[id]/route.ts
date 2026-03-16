import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// GET /api/heya/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("heya")
    .select("id, name, ichimon, created_year, closed_year")
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

// PUT /api/heya/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "部屋名は必須です" }, { status: 400 });
  }

  const supabase = createServerClient();
  const updateData: Record<string, unknown> = { name };
  updateData.ichimon      = body.ichimon      ?? null;
  updateData.created_year = body.created_year ? Number(body.created_year) : null;
  updateData.closed_year  = body.closed_year  ? Number(body.closed_year)  : null;

  const { error } = await supabase
    .from("heya")
    .update(updateData)
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "同名の部屋がすでに存在します" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// DELETE /api/heya/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  // 所属力士チェック
  const { count } = await supabase
    .from("rikishi")
    .select("id", { count: "exact", head: true })
    .eq("heya_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `この部屋には ${count} 人の力士が登録されています。先に力士の部屋情報を変更してください。` },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("heya").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

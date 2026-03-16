import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// PUT /api/themes/[id] - テーマ更新
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const label = (body.label ?? "").trim();
  if (!label) {
    return NextResponse.json({ error: "タイトルは必須です" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("curated_themes")
    .update({
      emoji:          body.emoji          ?? "🏆",
      label,
      description:    body.description    ?? "",
      filter_config:  body.filter_config  ?? {},
      show_all_ranks: body.show_all_ranks ?? false,
      sort_order:     body.sort_order     ?? 0,
      updated_at:     new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: "テーマが見つかりません" }, { status: 404 });
  return NextResponse.json(data);
}

// DELETE /api/themes/[id] - テーマ削除
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();
  const { error } = await supabase
    .from("curated_themes")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}

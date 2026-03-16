import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// GET /api/themes - テーマ一覧取得
export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("curated_themes")
    .select("*")
    .order("sort_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/themes - テーマ新規作成
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const label = (body.label ?? "").trim();
  if (!label) {
    return NextResponse.json({ error: "タイトルは必須です" }, { status: 400 });
  }

  // id を label から自動生成（スペース → _ 、英数字以外は除去）
  const rawId = (body.id ?? label)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "")
    .slice(0, 64);
  const id = rawId || `theme_${Date.now()}`;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("curated_themes")
    .insert({
      id,
      emoji:          body.emoji          ?? "🏆",
      label,
      description:    body.description    ?? "",
      filter_config:  body.filter_config  ?? {},
      show_all_ranks: body.show_all_ranks ?? false,
      sort_order:     body.sort_order     ?? 0,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "同じIDのテーマがすでに存在します" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

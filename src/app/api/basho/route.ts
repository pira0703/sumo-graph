import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// GET /api/basho — 場所マスタ一覧（新しい順）
export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("basho")
    .select("id, name, short_name, location, start_date, end_date")
    .order("id", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ basho: data ?? [] });
}

// POST /api/basho — 新規場所登録
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = (body.id ?? "").trim();
  if (!id || !/^\d{4}-\d{2}$/.test(id)) {
    return NextResponse.json({ error: "場所IDはYYYY-MM形式で入力してください" }, { status: 400 });
  }

  const supabase = createServerClient();
  const insertData: Record<string, unknown> = { id };
  if (body.name)       insertData.name       = (body.name       ?? "").trim();
  if (body.short_name) insertData.short_name = (body.short_name ?? "").trim();
  if (body.location)   insertData.location   = (body.location   ?? "").trim();
  if (body.start_date) insertData.start_date = body.start_date;
  if (body.end_date)   insertData.end_date   = body.end_date;

  const { data, error } = await supabase
    .from("basho")
    .insert(insertData)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "同じIDの場所がすでに存在します" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}

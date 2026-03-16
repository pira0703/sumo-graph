import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/** GET /api/oyakata-master — 全名跡一覧を返す */
export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("oyakata_master")
    .select("id, name, yomigana, ichimon, is_ichidai_toshiyori, notes")
    .order("yomigana", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/oyakata-master — 新規名跡登録 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "名跡名は必須です" }, { status: 400 });
  }

  const supabase = createServerClient();
  const insertData: Record<string, unknown> = {
    name,
    is_ichidai_toshiyori: body.is_ichidai_toshiyori === true,
  };
  if (body.yomigana) insertData.yomigana = body.yomigana.trim();
  if (body.ichimon)  insertData.ichimon  = body.ichimon;
  if (body.notes)    insertData.notes    = body.notes.trim();

  const { data, error } = await supabase
    .from("oyakata_master")
    .insert(insertData)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "同名の名跡がすでに存在します" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}

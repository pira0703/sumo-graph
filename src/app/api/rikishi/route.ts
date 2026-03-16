import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/** POST /api/rikishi
 * 新規力士を作成する
 * 必須: shikona
 * 任意: yomigana, heya_id, birth_date, active_from_basho, nationality, status, retirement_basho
 */
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const body = await req.json();

  const shikona = (body.shikona ?? "").trim();
  if (!shikona) {
    return NextResponse.json({ error: "四股名は必須です" }, { status: 400 });
  }

  const insertData: Record<string, unknown> = {
    shikona,
    status: "active",
  };

  const optionalFields = [
    "yomigana", "heya_id", "birth_date", "active_from_basho",
    "nationality", "status", "retirement_basho",
  ] as const;
  for (const f of optionalFields) {
    if (body[f] !== undefined && body[f] !== "" && body[f] !== null) {
      insertData[f] = body[f];
    }
  }

  const { data, error } = await supabase
    .from("rikishi")
    .insert(insertData)
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  const supabase = createServerClient();

  let query = supabase
    .from("rikishi")
    .select("id, shikona, yomigana, highest_rank, status, retirement_basho, photo_url, heya(name)")
    .order("shikona");

  if (q) {
    query = query.or(`shikona.ilike.%${q}%,yomigana.ilike.%${q}%`);
  }

  const { data, error } = await query.limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

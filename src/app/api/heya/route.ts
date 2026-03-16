import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("heya")
    .select("id, name, ichimon, created_year, closed_year")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "部屋名は必須です" }, { status: 400 });
  }

  const supabase = createServerClient();
  const insertData: Record<string, unknown> = { name };
  if (body.ichimon)      insertData.ichimon      = body.ichimon;
  if (body.created_year) insertData.created_year = Number(body.created_year);
  if (body.closed_year)  insertData.closed_year  = Number(body.closed_year);

  const { data, error } = await supabase
    .from("heya")
    .insert(insertData)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "同名の部屋がすでに存在します" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}

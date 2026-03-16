/**
 * /api/schools
 * rikishi テーブルから distinct な高校・大学名を返す
 * GET /api/schools?type=high_school  → 高校一覧
 * GET /api/schools?type=university   → 大学一覧
 * GET /api/schools                   → 両方まとめて返す
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "high_school" | "university" | null

  const supabase = createServerClient();

  const results: { high_schools: string[]; universities: string[] } = {
    high_schools: [],
    universities: [],
  };

  if (!type || type === "high_school") {
    const { data, error } = await supabase
      .from("rikishi")
      .select("high_school")
      .not("high_school", "is", null)
      .order("high_school");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    results.high_schools = [
      ...new Set((data ?? []).map((r) => r.high_school as string)),
    ].sort();
  }

  if (!type || type === "university") {
    const { data, error } = await supabase
      .from("rikishi")
      .select("university")
      .not("university", "is", null)
      .order("university");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    results.universities = [
      ...new Set((data ?? []).map((r) => r.university as string)),
    ].sort();
  }

  return NextResponse.json(results);
}

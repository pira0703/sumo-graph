import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

interface Params { params: Promise<{ id: string }> }

// ─── GET: 当該力士の番付を取得 ────────────────────────────────────────────────
// ?all=1 を渡すと全場所の番付履歴を配列で返す
// 渡さない場合は最新の1件を { banzuke: ... } で返す
export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "1";
  const supabase = createServerClient();

  if (all) {
    const { data, error } = await supabase
      .from("banzuke")
      .select("*")
      .eq("rikishi_id", id)
      .order("basho", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ history: data ?? [] });
  }

  const { data, error } = await supabase
    .from("banzuke")
    .select("*")
    .eq("rikishi_id", id)
    .order("basho", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ banzuke: data ?? null });
}

// ─── DELETE: 番付エントリを削除 (?basho=YYYY-MM) ─────────────────────────────
export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const basho = searchParams.get("basho");
  if (!basho) return NextResponse.json({ error: "basho は必須です" }, { status: 400 });

  const supabase = createServerClient();
  const { error } = await supabase
    .from("banzuke")
    .delete()
    .eq("rikishi_id", id)
    .eq("basho", basho);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ─── PUT: 番付を upsert (rikishi_id + basho の UNIQUE 制約で上書き) ────────────
export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json() as {
    basho:         string;
    rank_class:    string;
    rank_number?:  number | null;
    rank_side?:    string | null;
    rank_display?: string | null;
  };

  const { basho, rank_class, rank_number, rank_side, rank_display } = body;

  if (!basho || !rank_class) {
    return NextResponse.json({ error: "basho と rank_class は必須です" }, { status: 400 });
  }

  // basho 書式チェック: YYYY-MM (MM は 01,03,05,07,09,11)
  if (!/^\d{4}-(01|03|05|07|09|11)$/.test(basho)) {
    return NextResponse.json(
      { error: "basho は YYYY-MM 形式で、月は 01/03/05/07/09/11 のいずれかです" },
      { status: 400 },
    );
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("banzuke")
    .upsert(
      {
        rikishi_id:   id,
        basho,
        rank_class,
        rank_number:  rank_number  ?? null,
        rank_side:    rank_side    ?? null,
        rank_display: rank_display ?? null,
      },
      { onConflict: "rikishi_id,basho" },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ banzuke: data });
}

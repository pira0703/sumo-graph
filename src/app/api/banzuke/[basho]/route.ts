import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

interface Params { params: Promise<{ basho: string }> }

// rank_class の表示順
const RANK_ORDER: Record<string, number> = {
  yokozuna:   1,
  ozeki:      2,
  sekiwake:   3,
  komusubi:   4,
  maegashira: 5,
  juryo:      6,
  makushita:  7,
  sandanme:   8,
  jonidan:    9,
  jonokuchi:  10,
};

// GET /api/banzuke/[basho]
// 指定場所の番付を全力士分（力士情報付き）で返す
export async function GET(_req: Request, { params }: Params) {
  const { basho } = await params;

  // basho 書式チェック
  if (!/^\d{4}-(01|03|05|07|09|11)$/.test(basho)) {
    return NextResponse.json(
      { error: "basho は YYYY-MM 形式で、月は 01/03/05/07/09/11 のいずれかです" },
      { status: 400 },
    );
  }

  const supabase = createServerClient();

  // 場所マスタ取得
  const { data: bashoMaster, error: bashoErr } = await supabase
    .from("basho")
    .select("id, name, short_name, location")
    .eq("id", basho)
    .maybeSingle();

  if (bashoErr) return NextResponse.json({ error: bashoErr.message }, { status: 500 });

  // 番付エントリ取得（力士情報を JOIN）
  const { data: entries, error: bzErr } = await supabase
    .from("banzuke")
    .select(`
      id, rikishi_id, basho, rank_class, rank_number, rank_side, rank_display,
      rikishi:rikishi_id (
        id, shikona, photo_url, heya_id,
        heya:heya_id ( name )
      )
    `)
    .eq("basho", basho)
    .order("rank_class")
    .order("rank_number")
    .order("rank_side");

  if (bzErr) return NextResponse.json({ error: bzErr.message }, { status: 500 });

  // クライアント側でソートしやすいよう rank_order を付加
  const sorted = (entries ?? [])
    .map((e) => ({ ...e, rank_order: RANK_ORDER[e.rank_class] ?? 99 }))
    .sort((a, b) => {
      if (a.rank_order !== b.rank_order) return a.rank_order - b.rank_order;
      if ((a.rank_number ?? 99) !== (b.rank_number ?? 99))
        return (a.rank_number ?? 99) - (b.rank_number ?? 99);
      // east before west
      const sideOrder = { east: 0, west: 1 };
      return (sideOrder[a.rank_side as keyof typeof sideOrder] ?? 2)
           - (sideOrder[b.rank_side as keyof typeof sideOrder] ?? 2);
    });

  return NextResponse.json({
    basho: bashoMaster ?? { id: basho, name: basho, short_name: basho, location: "" },
    entries: sorted,
  });
}

// ─── PUT /api/banzuke/[basho] ─────────────────────────────────────────────────
// 指定スロット（rank_class + rank_number + rank_side）に力士をアサイン (upsert)
// body: { rikishi_id, rank_class, rank_number, rank_side }
export async function PUT(req: Request, { params }: Params) {
  const { basho } = await params;

  if (!/^\d{4}-(01|03|05|07|09|11)$/.test(basho)) {
    return NextResponse.json(
      { error: "basho は YYYY-MM 形式で、月は 01/03/05/07/09/11 のいずれかです" },
      { status: 400 },
    );
  }

  const body = await req.json() as {
    rikishi_id:  string;
    rank_class:  string;
    rank_number: number | null;
    rank_side:   string | null;
  };

  const { rikishi_id, rank_class, rank_number, rank_side } = body;

  if (!rikishi_id || !rank_class) {
    return NextResponse.json({ error: "rikishi_id と rank_class は必須です" }, { status: 400 });
  }

  // rank_display を自動生成
  const PREFIX: Record<string, string> = {
    yokozuna: "Y", ozeki: "O", sekiwake: "S", komusubi: "K",
    maegashira: "M", juryo: "J",
    makushita: "Ms", sandanme: "Sd", jonidan: "Jd", jonokuchi: "Jk",
  };
  const p = PREFIX[rank_class] ?? rank_class;
  const n = rank_number ?? "";
  const s = rank_side === "east" ? "e" : rank_side === "west" ? "w" : "";
  const rank_display = `${p}${n}${s}`;

  const supabase = createServerClient();

  // 同スロットに既存の力士がいれば上書き (rikishi_id + basho の UNIQUE 制約を利用)
  const { data, error } = await supabase
    .from("banzuke")
    .upsert(
      {
        rikishi_id,
        basho,
        rank_class,
        rank_number:  rank_number ?? null,
        rank_side:    rank_side   ?? null,
        rank_display,
      },
      { onConflict: "rikishi_id,basho" },
    )
    .select(`
      id, rikishi_id, basho, rank_class, rank_number, rank_side, rank_display,
      rikishi:rikishi_id (
        id, shikona, photo_url, heya_id,
        heya:heya_id ( name )
      )
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}

// ─── DELETE /api/banzuke/[basho] ──────────────────────────────────────────────
// body: { rikishi_id } — 指定力士のこの場所の番付エントリを削除
export async function DELETE(req: Request, { params }: Params) {
  const { basho } = await params;

  if (!/^\d{4}-(01|03|05|07|09|11)$/.test(basho)) {
    return NextResponse.json(
      { error: "basho は YYYY-MM 形式で、月は 01/03/05/07/09/11 のいずれかです" },
      { status: 400 },
    );
  }

  const body = await req.json() as { rikishi_id: string };
  const { rikishi_id } = body;

  if (!rikishi_id) {
    return NextResponse.json({ error: "rikishi_id は必須です" }, { status: 400 });
  }

  const supabase = createServerClient();

  const { error } = await supabase
    .from("banzuke")
    .delete()
    .eq("rikishi_id", rikishi_id)
    .eq("basho", basho);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

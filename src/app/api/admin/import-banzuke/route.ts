import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/**
 * POST /api/admin/import-banzuke
 *
 * CSVデータから番付を一括インポート。
 *
 * 期待するCSVフォーマット（ヘッダー行あり）:
 *   basho,shikona,rank_class,rank_number,rank_side
 *
 * 例:
 *   2025-01,照ノ富士,yokozuna,,east
 *   2025-01,琴桜,ozeki,,east
 *   2025-01,大の里,maegashira,1,east
 *
 * rank_number は上位4役（横綱〜小結）では空欄可。
 * rank_display は自動生成。
 *
 * 処理: shikona で rikishi を検索 → banzuke を upsert
 * conflictキー: rikishi_id + basho（1力士1場所1エントリ）
 *
 * レスポンス:
 *   { ok: true, inserted: number, skipped: { row: number, reason: string }[] }
 */

interface CsvRow {
  basho:       string;
  shikona:     string;
  rank_class:  string;
  rank_number: string;
  rank_side:   string;
}

const VALID_RANK_CLASS = new Set([
  "yokozuna","ozeki","sekiwake","komusubi","maegashira",
  "juryo","makushita","sandanme","jonidan","jonokuchi",
]);

const PREFIX: Record<string, string> = {
  yokozuna: "Y", ozeki: "O", sekiwake: "S", komusubi: "K",
  maegashira: "M", juryo: "J",
  makushita: "Ms", sandanme: "Sd", jonidan: "Jd", jonokuchi: "Jk",
};

function autoDisplay(rc: string, rn: string, rs: string): string {
  const p = PREFIX[rc] ?? rc;
  const n = rn.trim() ? rn.trim() : "";
  const s = rs === "east" ? "e" : rs === "west" ? "w" : "";
  return `${p}${n}${s}`;
}

/** シンプルな CSV パーサ（改行・カンマのみ対応） */
function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map(line => line.split(",").map(c => c.trim()));
}

export async function POST(req: Request) {
  const body = await req.json() as { csv: string };
  const { csv } = body;

  if (!csv || typeof csv !== "string") {
    return NextResponse.json({ error: "csv フィールドが必要です" }, { status: 400 });
  }

  const lines = parseCsv(csv.trim());
  if (lines.length < 2) {
    return NextResponse.json({ error: "データが空です（ヘッダー行＋1行以上が必要）" }, { status: 400 });
  }

  // ヘッダー行を除去
  const [header, ...dataLines] = lines;
  const hIdx = {
    basho:       header.indexOf("basho"),
    shikona:     header.indexOf("shikona"),
    rank_class:  header.indexOf("rank_class"),
    rank_number: header.indexOf("rank_number"),
    rank_side:   header.indexOf("rank_side"),
  };

  if (Object.values(hIdx).some(i => i === -1)) {
    return NextResponse.json(
      { error: `必須カラムが見つかりません。ヘッダーに basho, shikona, rank_class, rank_number, rank_side が必要です` },
      { status: 400 },
    );
  }

  const supabase = createServerClient();

  const skipped: { row: number; reason: string }[] = [];
  let inserted = 0;

  for (let i = 0; i < dataLines.length; i++) {
    const cols = dataLines[i];
    if (cols.length < 2 || cols.every(c => !c)) continue; // 空行をスキップ

    const row: CsvRow = {
      basho:       cols[hIdx.basho]       ?? "",
      shikona:     cols[hIdx.shikona]     ?? "",
      rank_class:  cols[hIdx.rank_class]  ?? "",
      rank_number: cols[hIdx.rank_number] ?? "",
      rank_side:   cols[hIdx.rank_side]   ?? "",
    };

    const rowNum = i + 2; // ヘッダーが1行目、データが2行目〜

    // バリデーション
    if (!/^\d{4}-(01|03|05|07|09|11)$/.test(row.basho)) {
      skipped.push({ row: rowNum, reason: `basho 書式エラー: "${row.basho}"` });
      continue;
    }
    if (!row.shikona) {
      skipped.push({ row: rowNum, reason: "shikona が空" });
      continue;
    }
    if (!VALID_RANK_CLASS.has(row.rank_class)) {
      skipped.push({ row: rowNum, reason: `rank_class 不正: "${row.rank_class}"` });
      continue;
    }
    if (row.rank_side && !["east", "west"].includes(row.rank_side)) {
      skipped.push({ row: rowNum, reason: `rank_side 不正: "${row.rank_side}"` });
      continue;
    }

    // shikona で力士を検索
    const { data: rikishiList, error: rErr } = await supabase
      .from("rikishi")
      .select("id, shikona")
      .eq("shikona", row.shikona)
      .limit(1);

    if (rErr) {
      skipped.push({ row: rowNum, reason: `DB検索エラー: ${rErr.message}` });
      continue;
    }
    if (!rikishiList || rikishiList.length === 0) {
      skipped.push({ row: rowNum, reason: `力士が見つかりません: "${row.shikona}"` });
      continue;
    }

    const rikishi = rikishiList[0];
    const rank_display = autoDisplay(row.rank_class, row.rank_number, row.rank_side);

    // upsert
    const { error: uErr } = await supabase
      .from("banzuke")
      .upsert(
        {
          rikishi_id:   rikishi.id,
          basho:        row.basho,
          rank_class:   row.rank_class,
          rank_number:  row.rank_number ? parseInt(row.rank_number) : null,
          rank_side:    row.rank_side   || null,
          rank_display,
        },
        { onConflict: "rikishi_id,basho" },
      );

    if (uErr) {
      skipped.push({ row: rowNum, reason: `upsertエラー: ${uErr.message}` });
      continue;
    }

    inserted++;
  }

  return NextResponse.json({ ok: true, inserted, skipped });
}

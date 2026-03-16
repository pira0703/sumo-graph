/**
 * seed-banzuke-all.ts
 * 2026年三月場所 全6段の番付データをSupabaseに投入する
 *
 * データソース: banzuke-2026-03-raw.json (JSAサイトから抽出済み)
 *   298行 (幕内:21, 十両:14, 幕下:61, 三段目:81, 序二段:100, 序の口:21)
 *
 * 処理ステップ:
 *   1. 部屋マスタ UPSERT（新規部屋のみ追加、既存部屋の ichimon は保持）
 *   2. 力士 UPSERT（ignoreDuplicates=true で seed-makuuchi.ts の精選データ保持）
 *   3. banzuke 全削除（basho=2026-03）+ 全挿入
 *
 * 実行:
 *   op run --env-file=.env.local -- npx tsx scripts/seed-banzuke-all.ts
 *
 * ⚑ seed-makuuchi.ts との関係:
 *   - 力士の詳細データ（born_year, yomigana 等）は seed-makuuchi.ts が管理
 *   - このスクリプトは「部屋追加 + 全banzuke構築」に特化
 *   - 実行順: seed-makuuchi.ts → seed-banzuke-all.ts（推奨）
 *     ※ 逆順でも動くが幕内力士のデータが最小限になる
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ─── Supabase クライアント ───────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ 環境変数が未設定（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BASHO = "2026-03";

// ─── 型定義 ───────────────────────────────────────────────────────────────────

type RawRow = { rank: string; east: string; west: string };
type RawJson = {
  basho: string;
  divisions: Record<string, RawRow[]>;
};

type WrestlerEntry = {
  shikona: string;
  heya: string;
  born_place: string;
  rank_class: string;
  rank_number: number | null;
  rank_side: "east" | "west";
  rank_display: string;
};

// ─── 漢数字パーサー ───────────────────────────────────────────────────────────
//
// 対応フォーマット:
//   幕内前頭: "筆頭", "二", "三", ..., "十七"  (「前頭」を除去済みで渡す)
//   十両〜:   "筆頭", "二枚目", ..., "十枚目", "十一枚目", ..., "百枚目"
//
function parseKanjiNumber(text: string): number | null {
  if (!text) return null;

  // 「枚目」を除去
  const t = text.replace(/枚目$/, "").trim();

  if (t === "筆頭") return 1;
  if (t === "百")   return 100;

  const digits: Record<string, number> = {
    一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
  };

  // [X]十[Y] パターン（十=10, 十一=11, 二十=20, 九十九=99）
  const juu = t.match(/^([一二三四五六七八九]?)十([一二三四五六七八九]?)$/);
  if (juu) {
    const tens = juu[1] ? (digits[juu[1]] ?? 1) : 1;
    const ones = juu[2] ? (digits[juu[2]] ?? 0) : 0;
    return tens * 10 + ones;
  }

  // 一桁
  if (t in digits) return digits[t];

  return null;
}

// ─── 力士テキストパーサー ─────────────────────────────────────────────────────
//
// 入力: "四股名 出身地 部屋名" （部屋名には「部屋」サフィックスなし）
// 出力: { shikona, born_place, heya } (heya には「部屋」を追加)
//
function parseWrestler(
  text: string
): { shikona: string; born_place: string; heya: string } | null {
  if (!text?.trim()) return null;
  const parts = text.trim().split(/\s+/);
  if (parts.length < 3) return null;
  return {
    shikona:    parts[0],
    born_place: parts.slice(1, -1).join(" "),
    heya:       parts[parts.length - 1] + "部屋",
  };
}

// ─── 幕内ランク情報 ───────────────────────────────────────────────────────────

const MAKUUCHI_NAMED: Record<string, { rank_class: string; prefix: string }> = {
  横綱: { rank_class: "yokozuna",   prefix: "Y" },
  大関: { rank_class: "ozeki",      prefix: "O" },
  関脇: { rank_class: "sekiwake",   prefix: "S" },
  小結: { rank_class: "komusubi",   prefix: "K" },
};

/** 幕内 1行分のランク情報を返す（横綱/大関/関脇/小結 は rowCounters を更新） */
function getMakuuchiRankInfo(
  rank: string,
  rowCounters: Record<string, number>
): { rank_class: string; prefix: string; rank_number: number } | null {
  // 前頭
  if (rank.startsWith("前頭")) {
    const suffix = rank.replace("前頭", "");
    const n = parseKanjiNumber(suffix);
    if (n === null) return null;
    return { rank_class: "maegashira", prefix: "M", rank_number: n };
  }
  // 横綱/大関/関脇/小結
  const info = MAKUUCHI_NAMED[rank];
  if (!info) return null;
  rowCounters[rank] = (rowCounters[rank] ?? 0) + 1;
  return { ...info, rank_number: rowCounters[rank] };
}

// ─── 下位段ランク情報 ─────────────────────────────────────────────────────────

const DIV_CONFIG: Record<string, { rank_class: string; prefix: string }> = {
  juryo:     { rank_class: "juryo",     prefix: "J"  },
  makushita: { rank_class: "makushita", prefix: "Ms" },
  sandanme:  { rank_class: "sandanme",  prefix: "Sd" },
  jonidan:   { rank_class: "jonidan",   prefix: "Jd" },
  jonokuchi: { rank_class: "jonokuchi", prefix: "Jk" },
};

function getLowerDivRankInfo(
  divKey: string,
  rank: string
): { rank_class: string; prefix: string; rank_number: number | null } | null {
  const config = DIV_CONFIG[divKey];
  if (!config) return null;
  if (rank === "付出") return { ...config, rank_number: null };
  const n = parseKanjiNumber(rank);
  return { ...config, rank_number: n };
}

// ─── 1段分の WrestlerEntry を生成 ────────────────────────────────────────────

function processDivision(divKey: string, rows: RawRow[]): WrestlerEntry[] {
  const entries: WrestlerEntry[] = [];
  const rowCounters: Record<string, number> = {};

  for (const row of rows) {
    let ri: { rank_class: string; prefix: string; rank_number: number | null } | null;

    if (divKey === "makuuchi") {
      const r = getMakuuchiRankInfo(row.rank, rowCounters);
      if (!r) {
        console.warn(`  ⚠️  幕内ランク解析失敗: "${row.rank}"`);
        continue;
      }
      ri = r;
    } else {
      ri = getLowerDivRankInfo(divKey, row.rank);
      if (!ri) {
        console.warn(`  ⚠️  ${divKey} ランク解析失敗: "${row.rank}"`);
        continue;
      }
    }

    const { rank_class, prefix, rank_number } = ri;
    const makeDisp = (side: "e" | "w") =>
      rank_number !== null ? `${prefix}${rank_number}${side}` : `${prefix}付出${side}`;

    // 東
    const ew = parseWrestler(row.east);
    if (ew) {
      entries.push({ ...ew, rank_class, rank_number, rank_side: "east", rank_display: makeDisp("e") });
    }

    // 西
    const ww = parseWrestler(row.west);
    if (ww) {
      entries.push({ ...ww, rank_class, rank_number, rank_side: "west", rank_display: makeDisp("w") });
    }
  }

  return entries;
}

// ─── 部屋→一門マッピング ────────────────────────────────────────────────────
// ソース: 日本相撲協会 相撲部屋一覧（ユーザー提供スクリーンショット 2026年3月確認）
// 部屋名は「XXX部屋」形式（parseWrestler が "部屋" サフィックスを付加）
const HEYA_ICHIMON: Record<string, string> = {
  // 出羽海一門
  "出羽海部屋":  "出羽海一門",
  "境川部屋":    "出羽海一門",
  "武隈部屋":    "出羽海一門",
  "藤島部屋":    "出羽海一門",
  "武蔵川部屋":  "出羽海一門",
  "二子山部屋":  "出羽海一門",
  "春日野部屋":  "出羽海一門",
  "玉ノ井部屋":  "出羽海一門",
  "雷部屋":      "出羽海一門",
  "山響部屋":    "出羽海一門",
  "木瀬部屋":    "出羽海一門",
  "尾上部屋":    "出羽海一門",
  "式秀部屋":    "出羽海一門",
  "立浪部屋":    "出羽海一門",
  // 二所ノ関一門
  "二所ノ関部屋": "二所ノ関一門",
  "中村部屋":    "二所ノ関一門",
  "佐渡ヶ嶽部屋": "二所ノ関一門",
  "押尾川部屋":  "二所ノ関一門",
  "鳴戸部屋":    "二所ノ関一門",
  "秀ノ山部屋":  "二所ノ関一門",
  "片男波部屋":  "二所ノ関一門",
  "田子ノ浦部屋": "二所ノ関一門",
  "西岩部屋":    "二所ノ関一門",
  "放駒部屋":    "二所ノ関一門",
  "芝田山部屋":  "二所ノ関一門",
  "高田川部屋":  "二所ノ関一門",
  "阿武松部屋":  "二所ノ関一門",
  "大嶽部屋":    "二所ノ関一門",
  "湊川部屋":    "二所ノ関一門",
  "湊部屋":      "二所ノ関一門",
  "錣山部屋":    "二所ノ関一門",
  // 時津風一門
  "時津風部屋":  "時津風一門",
  "荒汐部屋":    "時津風一門",
  "伊勢ノ海部屋": "時津風一門",
  "音羽山部屋":  "時津風一門",
  "追手風部屋":  "時津風一門",
  // 高砂一門
  "高砂部屋":    "高砂一門",
  "錦戸部屋":    "高砂一門",
  "九重部屋":    "高砂一門",
  "八角部屋":    "高砂一門",
  // 伊勢ヶ濱一門
  "伊勢ヶ濱部屋": "伊勢ヶ濱一門",
  "安治川部屋":  "伊勢ヶ濱一門",
  "大島部屋":    "伊勢ヶ濱一門",
  "浅香山部屋":  "伊勢ヶ濱一門",
  "朝日山部屋":  "伊勢ヶ濱一門",
};

// ─── メイン ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("🏋️  seed-banzuke-all.ts 開始");
  console.log(`   場所: ${BASHO}\n`);

  // ── 0. JSON ロード ────────────────────────────────────────────────────────
  const jsonPath = path.join(__dirname, "banzuke-2026-03-raw.json");
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ JSONファイルが見つからない: ${jsonPath}`);
    process.exit(1);
  }
  const rawJson: RawJson = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`📂 RAWデータロード: banzuke-2026-03-raw.json`);

  const divisionOrder = ["makuuchi", "juryo", "makushita", "sandanme", "jonidan", "jonokuchi"];
  const divLabels: Record<string, string> = {
    makuuchi: "幕内",   juryo:     "十両",
    makushita:"幕下",   sandanme:  "三段目",
    jonidan:  "序二段", jonokuchi: "序の口",
  };

  const allEntries: WrestlerEntry[] = [];
  const countByDiv: Record<string, number> = {};

  for (const divKey of divisionOrder) {
    const rows = rawJson.divisions[divKey] ?? [];
    const entries = processDivision(divKey, rows);
    countByDiv[divKey] = entries.length;
    allEntries.push(...entries);
    console.log(`   ${divLabels[divKey]}: ${rows.length}行 → ${entries.length}名`);
  }
  console.log(`   ─────────────────────────────────`);
  console.log(`   合計: ${allEntries.length}名\n`);

  // ── 1. 部屋 UPSERT（正しい ichimon を含めて INSERT/UPDATE）──────────────
  console.log("🏠 部屋 UPSERT...");
  const heyaNames = [...new Set(allEntries.map((e) => e.heya))].sort();
  console.log(`   ユニーク部屋数: ${heyaNames.length}`);

  const { error: heyaUpsertErr } = await supabase
    .from("heya")
    .upsert(
      heyaNames.map((name) => ({
        name,
        ichimon: HEYA_ICHIMON[name] ?? null,
      })),
      { onConflict: "name", ignoreDuplicates: false }
    );
  if (heyaUpsertErr) {
    console.error("❌ 部屋 UPSERT エラー:", heyaUpsertErr);
    process.exit(1);
  }

  const { data: heyaRows, error: heyaFetchErr } = await supabase
    .from("heya")
    .select("id, name")
    .in("name", heyaNames);
  if (heyaFetchErr) {
    console.error("❌ 部屋 SELECT エラー:", heyaFetchErr);
    process.exit(1);
  }

  const heyaMap = new Map<string, string>(
    (heyaRows ?? []).map((h: { id: string; name: string }) => [h.name, h.id])
  );
  console.log(`   ✅ 部屋マップ構築: ${heyaMap.size}件\n`);

  // ── 2. 力士 INSERT（未登録のみ）─────────────────────────────────────────
  // rikishi.shikona に UNIQUE 制約がないため UPSERT は使わず、
  // 既存四股名を先に SELECT して差分だけ INSERT する
  console.log("👤 力士 INSERT（未登録のみ）...");

  // 四股名で重複排除（同一力士が複数段に出ることは原則ないが安全のため）
  const shikonaSet = new Set<string>();
  const rikishiSeeds = allEntries.flatMap((e) => {
    if (shikonaSet.has(e.shikona)) return [];
    shikonaSet.add(e.shikona);
    const heya_id = heyaMap.get(e.heya) ?? null;
    if (!heya_id) console.warn(`   ⚠️  heya_id 未解決: ${e.shikona} (${e.heya})`);
    return [{
      shikona:    e.shikona,
      heya_id,
      born_place: e.born_place || null,
    }];
  });

  // 既存四股名を取得（重複 INSERT 防止）
  // 注: .in() に 500+ 件を渡すと URL が 16KB を超えるため全件 SELECT してクライアント側でフィルタ
  const { data: existingRikishi, error: existFetchErr } = await supabase
    .from("rikishi")
    .select("shikona");
  if (existFetchErr) {
    console.error("❌ 力士 SELECT エラー:", existFetchErr);
    process.exit(1);
  }
  const existingShikona = new Set(
    (existingRikishi ?? []).map((r: { shikona: string }) => r.shikona)
  );
  const toInsertRikishi = rikishiSeeds.filter((r) => !existingShikona.has(r.shikona));
  console.log(`   既存: ${existingShikona.size}名 / 新規INSERT: ${toInsertRikishi.length}名`);

  if (toInsertRikishi.length > 0) {
    const BATCH = 100;
    for (let i = 0; i < toInsertRikishi.length; i += BATCH) {
      const batch = toInsertRikishi.slice(i, i + BATCH);
      const { error } = await supabase.from("rikishi").insert(batch);
      if (error) {
        console.error(`❌ 力士 INSERT エラー (batch ${Math.floor(i / BATCH) + 1}):`, error);
        process.exit(1);
      }
    }
  }
  console.log(`   ✅ ${rikishiSeeds.length}名 処理完了`);

  // 力士 ID マップ構築（全件 SELECT してクライアント側でフィルタ）
  const shikonaTarget = new Set(allEntries.map((e) => e.shikona));
  const { data: rikishiRows, error: rikishiFetchErr } = await supabase
    .from("rikishi")
    .select("id, shikona");
  if (rikishiFetchErr) {
    console.error("❌ 力士 SELECT エラー:", rikishiFetchErr);
    process.exit(1);
  }

  const rikishiMap = new Map<string, string>(
    (rikishiRows ?? [])
      .filter((r: { id: string; shikona: string }) => shikonaTarget.has(r.shikona))
      .map((r: { id: string; shikona: string }) => [r.shikona, r.id])
  );
  console.log(`   力士マップ: ${rikishiMap.size}件\n`);

  // ── 3. banzuke DELETE (basho=2026-03) + INSERT ────────────────────────────
  console.log(`📊 banzuke (${BASHO}) 全削除 + 全挿入...`);

  const { error: delErr } = await supabase
    .from("banzuke")
    .delete()
    .eq("basho", BASHO);
  if (delErr) {
    console.error("❌ banzuke DELETE エラー:", delErr);
    process.exit(1);
  }
  console.log("   ✅ 既存データ削除完了");

  // banzuke 行を構築
  let skipped = 0;
  const banzukeRows = allEntries.flatMap((e) => {
    const rikishi_id = rikishiMap.get(e.shikona);
    if (!rikishi_id) {
      console.warn(`   ⚠️  banzuke: 力士IDが見つからない → ${e.shikona}`);
      skipped++;
      return [];
    }
    return [{
      rikishi_id,
      basho:        BASHO,
      rank_class:   e.rank_class,
      rank_number:  e.rank_number,
      rank_side:    e.rank_side,
      rank_display: e.rank_display,
    }];
  });

  if (skipped > 0) {
    console.warn(`   ⚠️  スキップ: ${skipped}名（rikishi_id 未解決）`);
  }

  console.log(`   挿入件数: ${banzukeRows.length}行`);

  const BATCH = 100;
  for (let i = 0; i < banzukeRows.length; i += BATCH) {
    const batch = banzukeRows.slice(i, i + BATCH);
    const { error } = await supabase.from("banzuke").insert(batch);
    if (error) {
      console.error(`❌ banzuke INSERT エラー (batch ${Math.floor(i / BATCH) + 1}):`, error);
      process.exit(1);
    }
  }
  console.log(`   ✅ ${banzukeRows.length}行 INSERT完了`);

  // ── 完了サマリー ──────────────────────────────────────────────────────────
  console.log("\n🎉 seed-banzuke-all.ts 完了！");
  console.log(`   場所:    ${BASHO}`);
  console.log(`   部屋:    ${heyaMap.size}件`);
  console.log(`   力士:    ${rikishiSeeds.length}名`);
  console.log(`   banzuke: ${banzukeRows.length}行`);
  console.log("   ─────────────────────────────────");
  for (const divKey of divisionOrder) {
    console.log(`   ${divLabels[divKey].padEnd(4)}: ${countByDiv[divKey]}名`);
  }
}

main().catch((err) => {
  console.error("❌ 予期せぬエラー:", err);
  process.exit(1);
});

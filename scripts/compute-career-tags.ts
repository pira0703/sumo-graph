/**
 * compute-career-tags.ts
 * banzuke 履歴から力士のキャリアタグを計算して rikishi テーブルを更新する。
 *
 * 計算項目:
 *   career_trend:    直近5関取場所のトレンド (rising|stable|declining|volatile)
 *   career_stage:    関取場所数によるキャリアステージ (veteran|mid|new)
 *   promotion_speed: 初土俵→初関取の速さ (fast|normal|late)
 *
 * 実行方法:
 *   DRY_RUN=true  op run --env-file=.env.local -- npx tsx scripts/compute-career-tags.ts
 *   DRY_RUN=false op run --env-file=.env.local -- npx tsx scripts/compute-career-tags.ts
 *
 * 毎場所シード後に DRY_RUN=false で実行してキャリアタグを最新化すること。
 *
 * ── バグ修正履歴（2026-03-16） ───────────────────────────────────────────────
 * Bug1: Supabase 1000行制限 → ページネーションループで全件取得に変更
 * Bug2: 幕下以下の2026-03レコード混入で「初関取=2026-03」と誤計算
 *       → 関取レコード（RANK_ORDERに含まれるもの）のみで計算するよう修正
 */

import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.env.DRY_RUN !== "false";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です");
}
const supabase = createClient(supabaseUrl, supabaseKey);

/** 関取番付クラス → 数値順位（小さいほど上位）。これ以外は幕下以下。 */
const RANK_ORDER: Record<string, number> = {
  yokozuna: 1, ozeki: 2, sekiwake: 3, komusubi: 4, maegashira: 5, juryo: 6,
};

/** 場所ID (YYYY-MM) → 通し番号 */
function bashoToIndex(basho: string): number {
  const [y, m] = basho.split("-").map(Number);
  return y * 6 + (m - 1) / 2;
}

type CareerTrend    = "rising" | "stable" | "declining" | "volatile";
type CareerStage    = "veteran" | "mid" | "new";
type PromotionSpeed = "fast" | "normal" | "late";

interface BEntry { basho: string; rank_class: string; }
interface TagResult {
  id:              string;
  career_trend:    CareerTrend | null;
  career_stage:    CareerStage | null;
  promotion_speed: PromotionSpeed | null;
}

/** Supabase 1000行制限をページネーションで回避して全件取得 */
async function fetchAllBanzuke(): Promise<Array<BEntry & { rikishi_id: string }>> {
  const PAGE = 1000;
  const all: Array<BEntry & { rikishi_id: string }> = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("banzuke")
      .select("rikishi_id, basho, rank_class")
      .order("basho", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    process.stdout.write(`\r  banzuke取得中: ${all.length}件...`);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  console.log(`\r  banzuke全件取得完了: ${all.length}件`);
  return all;
}

async function main() {
  console.log(`🏟  compute-career-tags  [DRY_RUN=${DRY_RUN}]`);

  const banzukeAll = await fetchAllBanzuke();

  // ─── 力士の初土俵を取得
  const { data: rikishiAll, error: rErr } = await supabase
    .from("rikishi").select("id, active_from_basho");
  if (rErr) throw rErr;

  const debutMap = new Map(
    (rikishiAll ?? []).map((r) => [r.id, r.active_from_basho as string | null])
  );

  // ─── 力士別にグループ化（全番付）
  const byRikishi = new Map<string, BEntry[]>();
  for (const row of banzukeAll) {
    if (!byRikishi.has(row.rikishi_id)) byRikishi.set(row.rikishi_id, []);
    byRikishi.get(row.rikishi_id)!.push({ basho: row.basho, rank_class: row.rank_class });
  }

  const results: TagResult[] = [];

  for (const [id, allHistory] of byRikishi) {
    // ★ Bug2修正: 関取レコード（幕内・十両）のみ抽出して計算
    const sekitoriHistory = allHistory.filter((h) => RANK_ORDER[h.rank_class] !== undefined);

    // 関取経験なし → 全タグ null
    if (sekitoriHistory.length === 0) {
      results.push({ id, career_trend: null, career_stage: null, promotion_speed: null });
      continue;
    }

    // career_stage: 関取場所数
    const total = sekitoriHistory.length;
    const career_stage: CareerStage =
      total >= 30 ? "veteran" : total >= 15 ? "mid" : "new";

    // career_trend: 直近5関取場所のトレンド
    const recent = sekitoriHistory.slice(-5);
    const orders = recent.map((h) => RANK_ORDER[h.rank_class]);
    let career_trend: CareerTrend = "stable";
    if (orders.length >= 2) {
      const first       = orders[0];
      const last        = orders[orders.length - 1];
      const hasJuryo    = orders.includes(6);
      const hasMakuuchi = orders.some((o) => o <= 5);
      const span        = Math.max(...orders) - Math.min(...orders);
      if (span >= 2 && hasJuryo && hasMakuuchi) {
        career_trend = "volatile";
      } else if (last < first) {
        career_trend = "rising";
      } else if (last > first) {
        career_trend = "declining";
      }
    }

    // promotion_speed: 初土俵 → 初関取
    const debut              = debutMap.get(id);
    const firstSekitoriBasho = sekitoriHistory[0]?.basho;
    let promotion_speed: PromotionSpeed | null = null;
    if (debut && firstSekitoriBasho) {
      const diff = bashoToIndex(firstSekitoriBasho) - bashoToIndex(debut);
      promotion_speed = diff <= 10 ? "fast" : diff <= 20 ? "normal" : "late";
    }

    results.push({ id, career_trend, career_stage, promotion_speed });
  }

  // ─── サマリー表示
  const sekitoriCount = results.filter((r) => r.career_stage !== null).length;
  console.log(`\n📊 計算結果 (全${results.length}名 / 関取経験${sekitoriCount}名):`);
  const count = (arr: (string | null)[]) =>
    arr.reduce((m, v) => { m[v ?? "null"] = (m[v ?? "null"] ?? 0) + 1; return m; }, {} as Record<string, number>);
  console.log("  career_trend    :", count(results.map((r) => r.career_trend)));
  console.log("  career_stage    :", count(results.map((r) => r.career_stage)));
  console.log("  promotion_speed :", count(results.map((r) => r.promotion_speed)));

  if (DRY_RUN) {
    console.log("\n🔍 DRY_RUN=true のため DB 更新をスキップ。");
    console.log("   本番実行: DRY_RUN=false op run --env-file=.env.local -- npx tsx scripts/compute-career-tags.ts");
    return;
  }

  // ─── バッチ UPDATE (50件ずつ)
  const BATCH = 50;
  let success = 0;
  let errors  = 0;
  for (let i = 0; i < results.length; i += BATCH) {
    for (const u of results.slice(i, i + BATCH)) {
      const { error } = await supabase.from("rikishi").update({
        career_trend:    u.career_trend,
        career_stage:    u.career_stage,
        promotion_speed: u.promotion_speed,
      }).eq("id", u.id);
      if (error) { console.error(`  ❌ ${u.id}:`, error.message); errors++; }
      else success++;
    }
    process.stdout.write(`\r  Progress: ${Math.min(i + BATCH, results.length)} / ${results.length}`);
  }
  console.log(`\n\n✅ 完了: 成功 ${success} 件 / エラー ${errors} 件`);
  if (errors > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });

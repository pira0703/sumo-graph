/**
 * 力士間の関係を自動生成する
 * 同部屋・同郷・同一門を、DBのデータから自動的に生成する
 *
 * 実行:
 *   op run --env-file=.env.local -- npx tsx scripts/generate-relationships.ts
 *
 * オプション:
 *   --type douya|dokyo|ichimon  特定の関係タイプだけ生成
 *   --dry-run                   件数だけ確認してDBには書かない
 *   --active-only               現役力士同士の関係のみ生成
 *   --min-year 1990             デビュー年以降の力士に絞る
 *
 * 生成ロジック:
 *   同部屋 (douya):  同じ heya_id を持つ力士の組み合わせ
 *   同郷  (dokyo):   同じ born_place を持つ力士の組み合わせ
 *   同一門 (ichimon): 同じ ichimon を持つ heya に所属する力士の組み合わせ
 *
 * 注意:
 *   組み合わせ爆発を避けるため、同部屋・同郷それぞれに
 *   最大ペア数の上限を設けている (MAX_PAIRS_PER_GROUP)。
 *   上限を超えるグループは重要度でソートしてトップNのみ生成する。
 */

import { createClient } from "@supabase/supabase-js";

// ─── 設定 ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN      = args.includes("--dry-run");
const ACTIVE_ONLY  = args.includes("--active-only");
const TYPE_FILTER  = args.includes("--type") ? args[args.indexOf("--type") + 1] : null;
const MIN_YEAR     = args.includes("--min-year")
  ? parseInt(args[args.indexOf("--min-year") + 1]) : null;

// グループ内で生成するペアの最大数
// 同部屋20人いると C(20,2)=190ペア → 上限で絞る
const MAX_PAIRS_PER_GROUP = 50;

// 番付の重要度スコア (高いほど重要なペアを優先)
const RANK_SCORE: Record<string, number> = {
  yokozuna: 5, ozeki: 4, sekiwake: 3, komusubi: 2, maegashira: 1,
};

// ─── 型定義 ──────────────────────────────────────────────────────────────────

interface RikishiRow {
  id: string;
  shikona: string;
  heya_id: string | null;
  born_place: string | null;
  active_from: number | null;
  active_to: number | null;
  highest_rank: string;
}

interface HeyaRow {
  id: string;
  name: string;
  ichimon: string | null;
}

interface Relationship {
  rikishi_a_id: string;
  rikishi_b_id: string;
  relation_type: string;
  description: string | null;
}

// ─── ユーティリティ ──────────────────────────────────────────────────────────

/** ペアの重要度スコア: 両者の番付スコアの合計 */
function pairScore(a: RikishiRow, b: RikishiRow): number {
  return (RANK_SCORE[a.highest_rank] ?? 0) + (RANK_SCORE[b.highest_rank] ?? 0);
}

/** 全組み合わせ C(n,2) を返す。MAX_PAIRS_PER_GROUPを超える場合は重要ペアのみ */
function makePairs(members: RikishiRow[]): [RikishiRow, RikishiRow][] {
  if (members.length < 2) return [];

  const allPairs: [RikishiRow, RikishiRow][] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      allPairs.push([members[i], members[j]]);
    }
  }

  if (allPairs.length <= MAX_PAIRS_PER_GROUP) return allPairs;

  // スコア降順でソートして上位N件だけ返す
  return allPairs
    .sort((x, y) => pairScore(y[0], y[1]) - pairScore(x[0], x[1]))
    .slice(0, MAX_PAIRS_PER_GROUP);
}

/** 既存の関係セットに含まれるかチェック (a↔b双方向) */
function makeKey(a: string, b: string, type: string): string {
  const [x, y] = a < b ? [a, b] : [b, a];
  return `${x}|${y}|${type}`;
}

// ─── 関係生成ロジック ─────────────────────────────────────────────────────────

/** 同部屋関係を生成 */
function generateDouyaRelationships(
  rikishi: RikishiRow[],
  heyaMap: Map<string, HeyaRow>
): Relationship[] {
  // heya_id でグループ化
  const groups = new Map<string, RikishiRow[]>();
  for (const r of rikishi) {
    if (!r.heya_id) continue;
    const group = groups.get(r.heya_id) ?? [];
    group.push(r);
    groups.set(r.heya_id, group);
  }

  const rels: Relationship[] = [];
  for (const [heyaId, members] of groups) {
    if (members.length < 2) continue;
    const heya = heyaMap.get(heyaId);
    const heyaName = heya?.name ?? "同部屋";

    for (const [a, b] of makePairs(members)) {
      rels.push({
        rikishi_a_id: a.id,
        rikishi_b_id: b.id,
        relation_type: "同部屋",
        description: `${heyaName}の同部屋`,
      });
    }
  }
  return rels;
}

/** 同郷関係を生成 */
function generateDokyoRelationships(rikishi: RikishiRow[]): Relationship[] {
  // born_place でグループ化 (nullは除外)
  const groups = new Map<string, RikishiRow[]>();
  for (const r of rikishi) {
    if (!r.born_place) continue;
    const group = groups.get(r.born_place) ?? [];
    group.push(r);
    groups.set(r.born_place, group);
  }

  const rels: Relationship[] = [];
  for (const [place, members] of groups) {
    if (members.length < 2) continue;

    for (const [a, b] of makePairs(members)) {
      rels.push({
        rikishi_a_id: a.id,
        rikishi_b_id: b.id,
        relation_type: "同郷",
        description: `${place}出身の同郷`,
      });
    }
  }
  return rels;
}

/** 同一門関係を生成 */
function generateIchimonRelationships(
  rikishi: RikishiRow[],
  heyaMap: Map<string, HeyaRow>
): Relationship[] {
  // ichimon でグループ化
  const groups = new Map<string, RikishiRow[]>();
  for (const r of rikishi) {
    if (!r.heya_id) continue;
    const heya = heyaMap.get(r.heya_id);
    if (!heya?.ichimon) continue;
    const group = groups.get(heya.ichimon) ?? [];
    group.push(r);
    groups.set(heya.ichimon, group);
  }

  const rels: Relationship[] = [];
  for (const [ichimon, members] of groups) {
    if (members.length < 2) continue;

    for (const [a, b] of makePairs(members)) {
      // 同部屋の場合は「同一門」は不要 (同部屋のほうが強い関係)
      if (a.heya_id === b.heya_id) continue;

      rels.push({
        rikishi_a_id: a.id,
        rikishi_b_id: b.id,
        relation_type: "同一門",
        description: `${ichimon}の同門`,
      });
    }
  }
  return rels;
}

// ─── メイン処理 ───────────────────────────────────────────────────────────────

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔗  関係自動生成スクリプト");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (DRY_RUN)     console.log("   ⚡ DRY RUN モード");
  if (ACTIVE_ONLY) console.log("   📌 現役力士のみ");
  if (MIN_YEAR)    console.log(`   📅 ${MIN_YEAR}年以降デビュー`);
  if (TYPE_FILTER) console.log(`   🏷  タイプ: ${TYPE_FILTER}`);
  console.log();

  // ─── データ取得 ──────────────────────────────────────────────
  console.log("📥 力士・部屋データ取得中...");

  // 力士を取得
  let rikishiQuery = supabase
    .from("rikishi")
    .select("id, shikona, heya_id, born_place, active_from, active_to, highest_rank")
    .range(0, 9999); // デフォルト上限1000件を超えるため明示指定

  if (ACTIVE_ONLY) rikishiQuery = rikishiQuery.is("active_to", null);
  if (MIN_YEAR)    rikishiQuery = rikishiQuery.gte("active_from", MIN_YEAR);

  const { data: rikishiData, error: rikishiErr } = await rikishiQuery;
  if (rikishiErr) { console.error("力士取得エラー:", rikishiErr); process.exit(1); }

  const rikishi = rikishiData as RikishiRow[];
  console.log(`   力士: ${rikishi.length}名`);

  // 部屋を取得
  const { data: heyaData, error: heyaErr } = await supabase
    .from("heya").select("id, name, ichimon");
  if (heyaErr) { console.error("部屋取得エラー:", heyaErr); process.exit(1); }

  const heyaMap = new Map<string, HeyaRow>(
    (heyaData as HeyaRow[]).map(h => [h.id, h])
  );
  console.log(`   部屋: ${heyaMap.size}部屋`);

  // 既存の関係を取得 (重複防止)
  const { data: existingRels, error: existingErr } = await supabase
    .from("relationships")
    .select("rikishi_a_id, rikishi_b_id, relation_type");
  if (existingErr) { console.error("既存関係取得エラー:", existingErr); process.exit(1); }

  const existingKeys = new Set<string>(
    (existingRels ?? []).map((r: any) =>
      makeKey(r.rikishi_a_id, r.rikishi_b_id, r.relation_type)
    )
  );
  console.log(`   既存関係: ${existingKeys.size}件`);

  // ─── 関係生成 ────────────────────────────────────────────────
  console.log("\n🔨 関係生成中...");

  const allRels: Relationship[] = [];

  if (!TYPE_FILTER || TYPE_FILTER === "douya") {
    const rels = generateDouyaRelationships(rikishi, heyaMap);
    console.log(`   同部屋:  ${rels.length}件`);
    allRels.push(...rels);
  }

  if (!TYPE_FILTER || TYPE_FILTER === "dokyo") {
    const rels = generateDokyoRelationships(rikishi);
    console.log(`   同郷:    ${rels.length}件`);
    allRels.push(...rels);
  }

  if (!TYPE_FILTER || TYPE_FILTER === "ichimon") {
    const rels = generateIchimonRelationships(rikishi, heyaMap);
    console.log(`   同一門:  ${rels.length}件`);
    allRels.push(...rels);
  }

  // 重複除去 (既存 + 今回生成内の重複)
  const newKeys = new Set<string>();
  const deduped = allRels.filter(r => {
    const key = makeKey(r.rikishi_a_id, r.rikishi_b_id, r.relation_type);
    if (existingKeys.has(key) || newKeys.has(key)) return false;
    newKeys.add(key);
    return true;
  });

  console.log(`\n   合計 (重複除去後): ${deduped.length}件`);

  if (DRY_RUN) {
    console.log("\n✅ DRY RUN完了。--dry-run フラグを外して実行するとDB投入されます。");
    return;
  }

  if (deduped.length === 0) {
    console.log("   追加する関係がありません。");
    return;
  }

  // ─── Supabase投入 ────────────────────────────────────────────
  console.log("\n💾 DB投入中...");

  const BATCH = 500;
  let inserted = 0;

  for (let i = 0; i < deduped.length; i += BATCH) {
    const batch = deduped.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("relationships").insert(batch).select("id");
    if (error) {
      console.error(`\n   バッチ${i}エラー:`, error.message);
    } else {
      inserted += data!.length;
    }
    process.stdout.write(`   ${inserted}/${deduped.length} 投入中...\r`);
  }

  console.log(`\n   ✅ ${inserted}件 投入完了`);

  // ─── 完了 ────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎉 関係生成完了！");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   ブラウザで確認: http://localhost:3001");
}

main().catch(err => {
  console.error("致命的エラー:", err);
  process.exit(1);
});

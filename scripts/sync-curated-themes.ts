/**
 * sync-curated-themes.ts
 * themes.ts の CURATED_THEMES を curated_themes テーブルに同期する
 *
 * 実行方法:
 *   op run --env-file=.env.local -- npx tsx scripts/sync-curated-themes.ts
 *
 * ── 動作 ──────────────────────────────────────────────────────────────────
 * 1. themes.ts の全テーマを UPSERT（存在すれば更新・なければ INSERT）
 * 2. DB に存在するが themes.ts にない旧テーマを DELETE
 *
 * 冪等設計 ── 何度実行しても同じ結果になる
 * ─────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";
import { CURATED_THEMES } from "../src/constants/themes";

const DRY_RUN = process.env.DRY_RUN !== "false";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log(`\n🎌 sync-curated-themes.ts  [DRY_RUN=${DRY_RUN}]\n`);

  // ── 現在のDBテーマを取得 ────────────────────────────────────────────────
  const { data: existing, error: fetchErr } = await supabase
    .from("curated_themes")
    .select("id, label")
    .order("sort_order");

  if (fetchErr) throw new Error(`DB取得失敗: ${fetchErr.message}`);
  console.log(`DB既存テーマ: ${existing?.length ?? 0}件`);
  existing?.forEach((t) => console.log(`  - ${t.id} (${t.label})`));

  // ── UPSERT: themes.ts の全テーマを同期 ─────────────────────────────────
  console.log(`\n📤 UPSERT: ${CURATED_THEMES.length}件`);

  const upsertPayload = CURATED_THEMES.map((t, i) => ({
    id:             t.id,
    emoji:          t.emoji,
    label:          t.label,
    description:    t.description,
    filter_config:  t.filter,
    show_all_ranks: false,          // rankDivisions で管理するため常に false
    sort_order:     i + 1,          // themes.ts の順番をそのまま使う
  }));

  for (const row of upsertPayload) {
    console.log(`  UPSERT: [${row.id}] ${row.emoji} ${row.label}`);
    if (!DRY_RUN) {
      const { error } = await supabase
        .from("curated_themes")
        .upsert(row, { onConflict: "id" });
      if (error) console.error(`    ❌ エラー: ${error.message}`);
      else       console.log(`    ✅ 完了`);
    }
  }

  // ── DELETE: DB にあるが themes.ts にない旧テーマを削除 ──────────────────
  const currentIds = new Set(CURATED_THEMES.map((t) => t.id));
  const toDelete   = (existing ?? []).filter((t) => !currentIds.has(t.id));

  if (toDelete.length === 0) {
    console.log("\n🗑️  削除対象なし");
  } else {
    console.log(`\n🗑️  DELETE: ${toDelete.length}件`);
    for (const row of toDelete) {
      console.log(`  DELETE: [${row.id}] ${row.label}`);
      if (!DRY_RUN) {
        const { error } = await supabase
          .from("curated_themes")
          .delete()
          .eq("id", row.id);
        if (error) console.error(`    ❌ エラー: ${error.message}`);
        else       console.log(`    ✅ 削除完了`);
      }
    }
  }

  // ── 結果サマリー ───────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────────");
  if (DRY_RUN) {
    console.log("🌀 DRY RUN 完了 ── 実際には何も変更していません");
    console.log("   本番実行: DRY_RUN=false op run --env-file=.env.local -- npx tsx scripts/sync-curated-themes.ts");
  } else {
    console.log(`✅ 同期完了: UPSERT ${upsertPayload.length}件 / DELETE ${toDelete.length}件`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * update-jsa-ids.ts
 * rikishi_jsa_mapping.json の jsa_id を DB の rikishi テーブルに一括反映する
 *
 * 実行方法:
 *   op run --env-file=.env.local -- npx tsx scripts/update-jsa-ids.ts
 *
 * 前提:
 *   - migrations/011_add_jsa_id.sql 適用済み（jsa_id カラム存在）
 *   - scripts/data/rikishi_jsa_mapping.json 生成済み（Phase 1 完了）
 *
 * マッチング戦略:
 *   1. 四股名完全一致（shikona）→ メインルート
 *   2. 不一致分はログに出力して手動対応
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface JsaEntry {
  jsa_id: number;
  shikona: string;
  yomigana: string | null;
}

async function main() {
  // 1. マッピングファイル読み込み
  const mappingPath = path.join(
    process.cwd(),
    "scripts/data/rikishi_jsa_mapping.json"
  );
  const raw = JSON.parse(fs.readFileSync(mappingPath, "utf-8"));
  const jsaMap = new Map<string, number>(
    (raw.data as JsaEntry[]).map((e) => [e.shikona, e.jsa_id])
  );
  console.log(`📂 Loaded ${jsaMap.size} JSA entries from mapping file`);

  // 2. DB から全力士取得
  const { data: rikishiList, error } = await supabase
    .from("rikishi")
    .select("id, shikona, jsa_id")
    .order("shikona");

  if (error) throw new Error(`DB fetch error: ${error.message}`);
  console.log(`📊 DB rikishi count: ${rikishiList!.length}`);

  // 3. マッチング & 更新
  const matched: { id: string; shikona: string; jsa_id: number }[] = [];
  const unmatched: string[] = [];
  const alreadySet: string[] = [];

  for (const r of rikishiList!) {
    if (r.jsa_id !== null) {
      alreadySet.push(r.shikona);
      continue;
    }
    const jsa_id = jsaMap.get(r.shikona);
    if (jsa_id !== undefined) {
      matched.push({ id: r.id, shikona: r.shikona, jsa_id });
    } else {
      unmatched.push(r.shikona);
    }
  }

  console.log(`\n✅ Matched:      ${matched.length}`);
  console.log(`⏭️  Already set:  ${alreadySet.length}`);
  console.log(`❌ Unmatched:    ${unmatched.length}`);

  // 4. バッチUPDATE（50件ずつ）
  const BATCH = 50;
  let updated = 0;
  for (let i = 0; i < matched.length; i += BATCH) {
    const batch = matched.slice(i, i + BATCH);
    for (const { id, jsa_id } of batch) {
      const { error: updateErr } = await supabase
        .from("rikishi")
        .update({ jsa_id })
        .eq("id", id);
      if (updateErr) {
        console.error(`  UPDATE ERROR [${id}]: ${updateErr.message}`);
      } else {
        updated++;
      }
    }
    console.log(`  Updated ${Math.min(i + BATCH, matched.length)} / ${matched.length}`);
  }

  console.log(`\n🎉 Done: ${updated} records updated`);

  // 5. 未マッチ一覧を出力（手動確認用）
  if (unmatched.length > 0) {
    console.log(`\n⚠️  Unmatched rikishi (${unmatched.length}):`);
    unmatched.forEach((n) => console.log(`  - ${n}`));

    const outPath = path.join(
      process.cwd(),
      "scripts/data/jsa_id_unmatched.json"
    );
    fs.writeFileSync(outPath, JSON.stringify(unmatched, null, 2), "utf-8");
    console.log(`\n  → 未マッチ一覧を保存: ${outPath}`);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

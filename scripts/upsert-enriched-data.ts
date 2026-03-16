/**
 * upsert-enriched-data.ts
 * rikishi_progress.json の enriched data を DB の rikishi テーブルに一括反映する
 *
 * 実行方法:
 *   op run --env-file=.env.local -- npx tsx scripts/upsert-enriched-data.ts
 *
 * 前提:
 *   - scripts/data/rikishi_progress.json 生成済み（Phase 3 完了）
 *   - rikishi テーブルに born_place, birth_date, real_name, photo_url, active_from_basho カラム存在
 *
 * 更新フィールド（全て null の場合は更新しない、既存値を上書きする）:
 *   - birth_date        (DATE)
 *   - active_from_basho (TEXT, e.g. "2018-01")
 *   - real_name         (TEXT)
 *   - born_place        (TEXT)
 *   - photo_url         (TEXT)
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ProgressEntry {
  id: string;
  shikona: string;
  jsa_id: number | null;
  db_status: string;
  status: string;
  birth_date: string | null;
  active_from_basho: string | null;
  real_name: string | null;
  born_place: string | null;
  photo_url: string | null;
  fetched_at: string;
}

const BATCH_SIZE = 50;

async function main() {
  // 1. progress ファイル読み込み
  const progressPath = path.join(
    process.cwd(),
    "scripts/data/rikishi_progress.json"
  );
  const raw: ProgressEntry[] = JSON.parse(fs.readFileSync(progressPath, "utf-8"));

  // 2. status=done のエントリのみ処理
  const done = raw.filter((e) => e.status === "done");
  console.log(`📂 Progress file loaded: ${raw.length} total, ${done.length} done`);

  // 3. 更新データなし（全フィールドnull）のエントリをスキップ
  const toUpdate = done.filter(
    (e) =>
      e.birth_date !== null ||
      e.active_from_basho !== null ||
      e.real_name !== null ||
      e.born_place !== null ||
      e.photo_url !== null
  );
  const skipped = done.length - toUpdate.length;
  console.log(`📝 Entries with data: ${toUpdate.length} (skipping ${skipped} all-null entries)`);

  // 4. バッチ UPDATE（id で照合）
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toUpdate.length / BATCH_SIZE);

    process.stdout.write(`\r[Batch ${batchNum}/${totalBatches}] Processing ${i + 1}-${Math.min(i + BATCH_SIZE, toUpdate.length)}...`);

    // 個別 UPDATE（Supabase は bulk update が id 照合では難しいため個別 or upsert）
    const results = await Promise.all(
      batch.map(async (entry) => {
        const updatePayload: Record<string, string | null> = {};
        if (entry.birth_date !== null)        updatePayload.birth_date = entry.birth_date;
        if (entry.active_from_basho !== null) updatePayload.active_from_basho = entry.active_from_basho;
        if (entry.real_name !== null)         updatePayload.real_name = entry.real_name;
        if (entry.born_place !== null)        updatePayload.born_place = entry.born_place;
        if (entry.photo_url !== null)         updatePayload.photo_url = entry.photo_url;

        const { error } = await supabase
          .from("rikishi")
          .update(updatePayload)
          .eq("id", entry.id);

        return { id: entry.id, shikona: entry.shikona, error };
      })
    );

    for (const r of results) {
      if (r.error) {
        errorCount++;
        console.error(`\n❌ ERROR [${r.shikona}]: ${r.error.message}`);
      } else {
        successCount++;
      }
    }
  }

  console.log(`\n\n✅ UPSERT complete!`);
  console.log(`   success: ${successCount}`);
  console.log(`   errors:  ${errorCount}`);
  console.log(`   skipped: ${skipped} (all-null entries)`);

  // 5. 統計サマリ
  const withBirth      = done.filter((e) => e.birth_date !== null).length;
  const withBasho      = done.filter((e) => e.active_from_basho !== null).length;
  const withRealName   = done.filter((e) => e.real_name !== null).length;
  const withBornPlace  = done.filter((e) => e.born_place !== null).length;
  const withPhoto      = done.filter((e) => e.photo_url !== null).length;

  console.log(`\n📊 Data coverage (594 wrestlers):`);
  console.log(`   birth_date:        ${withBirth} (${((withBirth / done.length) * 100).toFixed(1)}%)`);
  console.log(`   active_from_basho: ${withBasho} (${((withBasho / done.length) * 100).toFixed(1)}%)`);
  console.log(`   real_name:         ${withRealName} (${((withRealName / done.length) * 100).toFixed(1)}%)`);
  console.log(`   born_place:        ${withBornPlace} (${((withBornPlace / done.length) * 100).toFixed(1)}%)`);
  console.log(`   photo_url:         ${withPhoto} (${((withPhoto / done.length) * 100).toFixed(1)}%)`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

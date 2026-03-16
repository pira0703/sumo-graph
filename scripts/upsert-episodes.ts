/**
 * upsert-episodes.ts
 * Phase 5-A: wiki_episodes_progress.json から episodes / 欠損データを Supabase に UPSERT
 * 
 * 使い方:
 *   op run --env-file=.env.local -- npx tsx scripts/upsert-episodes.ts
 *   op run --env-file=.env.local -- npx tsx scripts/upsert-episodes.ts --batch=1  # バッチ指定
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !supabaseKey) {
  console.error("❌ 環境変数未設定");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

const PROGRESS = path.join(__dirname, "data", "wiki_episodes_progress.json");

async function main() {
  const raw = fs.readFileSync(PROGRESS, "utf-8");
  const entries: Array<{
    id: string; shikona: string; status: string; batch: number;
    episodes: string | null; birth_date: string | null;
    active_from_basho: string | null; high_school: string | null; university: string | null;
  }> = JSON.parse(raw);

  // --batch=N 引数があればそのバッチのみ
  const batchArg = process.argv.find((a) => a.startsWith("--batch="));
  const targetBatch = batchArg ? parseInt(batchArg.split("=")[1]) : null;

  const toUpdate = entries.filter(
    (e) => e.status === "done" && (targetBatch === null || e.batch === targetBatch)
  );

  console.log(`📂 Total: ${entries.length}  done: ${entries.filter(e=>e.status==="done").length}  pending: ${entries.filter(e=>e.status==="pending").length}`);
  console.log(`🔄 Upserting: ${toUpdate.length} entries${targetBatch ? ` (Batch ${targetBatch})` : ""}\n`);

  const BATCH_SIZE = 50;
  let success = 0, failed = 0;

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (entry) => {
      const payload: Record<string, string | null> = {};
      if (entry.episodes          !== null) payload.episodes          = entry.episodes;
      if (entry.birth_date        !== null) payload.birth_date        = entry.birth_date;
      if (entry.active_from_basho !== null) payload.active_from_basho = entry.active_from_basho;
      if (entry.high_school       !== null) payload.high_school       = entry.high_school;
      if (entry.university        !== null) payload.university        = entry.university;

      if (Object.keys(payload).length === 0) { success++; return; }

      const { error } = await supabase.from("rikishi").update(payload).eq("id", entry.id);
      if (error) { console.error(`❌ ${entry.shikona}: ${error.message}`); failed++; }
      else success++;
    }));
    console.log(`  ${Math.min(i + BATCH_SIZE, toUpdate.length)}/${toUpdate.length} processed`);
  }

  console.log(`\n✅ Done: success=${success}  failed=${failed}`);

  // カバレッジ表示
  const batches = [...new Set(entries.map(e => e.batch))].sort();
  console.log("\n📊 バッチ別進捗:");
  for (const b of batches) {
    const be = entries.filter(e => e.batch === b);
    const done = be.filter(e => e.status === "done").length;
    const skip = be.filter(e => e.status === "skip").length;
    const pend = be.filter(e => e.status === "pending").length;
    console.log(`   Batch ${b}: done=${done}  skip=${skip}  pending=${pend}  / ${be.length}`);
  }
}

main().catch(console.error);

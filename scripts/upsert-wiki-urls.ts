/**
 * upsert-wiki-urls.ts
 * Phase 4: wiki_progress.json から wiki_url を Supabase にUPSERT
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const WIKI_PROGRESS = path.join(__dirname, "data", "wiki_progress.json");

async function main() {
  const raw = fs.readFileSync(WIKI_PROGRESS, "utf-8");
  const entries: Array<{
    id: string;
    shikona: string;
    status: string;
    wiki_url: string | null;
  }> = JSON.parse(raw);

  // wiki_url が存在するエントリのみ対象
  const toUpdate = entries.filter(
    (e) => e.status === "done" && e.wiki_url !== null
  );

  console.log(`📂 Total entries : ${entries.length}`);
  console.log(`✅ With wiki_url : ${toUpdate.length}`);
  console.log(`   No wiki_url   : ${entries.length - toUpdate.length}\n`);

  if (toUpdate.length === 0) {
    console.log("Nothing to update.");
    return;
  }

  const BATCH = 50;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const batch = toUpdate.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (entry) => {
        const { error } = await supabase
          .from("rikishi")
          .update({ wiki_url: entry.wiki_url })
          .eq("id", entry.id);
        if (error) {
          console.error(`❌ ${entry.shikona}: ${error.message}`);
          failed++;
        } else {
          success++;
        }
      })
    );
    console.log(
      `  Batch ${Math.floor(i / BATCH) + 1}: processed ${Math.min(
        i + BATCH,
        toUpdate.length
      )}/${toUpdate.length}`
    );
  }

  console.log(`\n✅ Done: success=${success}  failed=${failed}`);

  // カバレッジ統計
  const done = entries.filter((e) => e.status === "done").length;
  const none = entries.filter((e) => e.status === "none").length;
  const pending = entries.filter((e) => e.status === "pending").length;
  console.log(`\n📊 Coverage:`);
  console.log(`   wiki_url あり : ${done} / ${entries.length} (${((done / entries.length) * 100).toFixed(1)}%)`);
  console.log(`   wiki_url なし : ${none}`);
  console.log(`   未処理        : ${pending}`);
}

main().catch(console.error);

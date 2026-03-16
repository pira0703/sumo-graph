/**
 * upsert-photo-urls.ts
 * Phase 5-B: photo_progress.json から photo_url を Supabase にUPDATE
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
const PHOTO_PROGRESS = path.join(__dirname, "data", "photo_progress.json");

async function main() {
  const raw = fs.readFileSync(PHOTO_PROGRESS, "utf-8");
  const entries: Array<{
    id: string;
    shikona: string;
    status: string;
    photo_url: string | null;
  }> = JSON.parse(raw);

  const toUpdate = entries.filter((e) => e.status === "done" && e.photo_url !== null);

  console.log(`📂 Total entries  : ${entries.length}`);
  console.log(`✅ With photo_url : ${toUpdate.length}`);
  console.log(`   No photo_url   : ${entries.length - toUpdate.length}\n`);

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
          .update({ photo_url: entry.photo_url })
          .eq("id", entry.id);
        if (error) {
          console.error(`❌ ${entry.shikona}: ${error.message}`);
          failed++;
        } else {
          success++;
        }
      })
    );
    console.log(`  Batch ${Math.floor(i / BATCH) + 1}: ${Math.min(i + BATCH, toUpdate.length)}/${toUpdate.length}`);
  }

  console.log(`\n✅ Done: success=${success}  failed=${failed}`);
  const done  = entries.filter((e) => e.status === "done").length;
  const none  = entries.filter((e) => e.status === "none").length;
  console.log(`\n📊 Coverage:`);
  console.log(`   photo_url あり : ${done} / ${entries.length} (${((done / entries.length) * 100).toFixed(1)}%)`);
  console.log(`   photo_url なし : ${none}`);
}

main().catch(console.error);

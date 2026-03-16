/**
 * fix-missing-basho.ts
 * basho マスタに不足しているレコードを追加し、
 * active_from_basho FK エラーだった10力士を再 UPDATE する
 *
 * 実行:
 *   op run --env-file=.env.local -- npx tsx scripts/fix-missing-basho.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MONTH_META: Record<number, { name: string; short: string; location: string }> = {
   1: { name: "初場所",     short: "初",     location: "東京" },
   3: { name: "春場所",     short: "春",     location: "大阪" },
   5: { name: "夏場所",     short: "夏",     location: "東京" },
   7: { name: "名古屋場所", short: "名古屋", location: "名古屋" },
   9: { name: "秋場所",     short: "秋",     location: "東京" },
  11: { name: "九州場所",   short: "九州",   location: "福岡" },
};

// 不足が判明している basho ID 群（1993〜1999 + 2026-03）
const MISSING_BASHO_IDS = [
  "1993-01","1993-03","1993-05","1993-07","1993-09","1993-11",
  "1994-01","1994-03","1994-05","1994-07","1994-09","1994-11",
  "1995-01","1995-03","1995-05","1995-07","1995-09","1995-11",
  "1996-01","1996-03","1996-05","1996-07","1996-09","1996-11",
  "1997-01","1997-03","1997-05","1997-07","1997-09","1997-11",
  "1998-01","1998-03","1998-05","1998-07","1998-09","1998-11",
  "1999-01","1999-03","1999-05","1999-07","1999-09","1999-11",
  "2026-03",
];

// エラーになった力士の四股名
const ERROR_RIKISHI = ["不動豊","大雷童","天一","武蔵海","潮来桜","甲斐田","翔傑","芳東","輝の里","飛燕力"];

async function main() {
  // 1. 不足 basho レコードを upsert
  console.log("🏯 Step 1: Insert missing basho records...");
  const bashoRecords = MISSING_BASHO_IDS.map((id) => {
    const [yearStr, monthStr] = id.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const meta = MONTH_META[month];
    const yy = String(year).slice(2);
    return {
      id,
      name:       `${year}年${meta.name}`,
      short_name: `${yy}${meta.short}`,
      location:   meta.location,
      start_date: null,
      end_date:   null,
    };
  });

  const { error: bashoError } = await supabase
    .from("basho")
    .upsert(bashoRecords, { onConflict: "id", ignoreDuplicates: true });

  if (bashoError) {
    console.error("❌ basho upsert error:", bashoError.message);
    process.exit(1);
  }
  console.log(`✅ ${bashoRecords.length} basho records inserted/confirmed`);

  // 2. progress.json から エラー力士の enriched data を取得
  console.log("\n🔄 Step 2: Re-upsert 10 error rikishi...");
  const progressPath = path.join(process.cwd(), "scripts/data/rikishi_progress.json");
  const allEntries = JSON.parse(fs.readFileSync(progressPath, "utf-8"));
  const errorEntries = allEntries.filter((e: any) => ERROR_RIKISHI.includes(e.shikona));
  console.log(`Found ${errorEntries.length} entries to retry`);

  let successCount = 0;
  let errorCount = 0;

  for (const entry of errorEntries) {
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

    if (error) {
      errorCount++;
      console.error(`  ❌ [${entry.shikona}] active_from=${entry.active_from_basho}: ${error.message}`);
    } else {
      successCount++;
      console.log(`  ✅ ${entry.shikona} (active_from=${entry.active_from_basho})`);
    }
  }

  console.log(`\n✅ Done: success=${successCount}, error=${errorCount}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

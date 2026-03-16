/**
 * init-progress.ts
 * rikishi_progress.json を初期化する（Phase 3 開始用）
 * DB から全力士の id / shikona / jsa_id を取得し status=pending で書き出す
 *
 * 実行方法:
 *   op run --env-file=.env.local -- npx tsx scripts/init-progress.ts
 *
 * 既存ファイルがある場合は done/error/skip を保持し、pending のみ上書きする
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OUT = path.join(process.cwd(), "scripts/data/rikishi_progress.json");

async function main() {
  // DB から全力士取得（番付順）
  const { data, error } = await sb
    .from("rikishi")
    .select("id, shikona, jsa_id, status")
    .order("shikona");

  if (error) throw new Error(error.message);
  console.log(`📊 DB rikishi: ${data!.length}`);

  // 既存 progress ファイルがあれば読み込む
  let existing: Record<string, object> = {};
  if (fs.existsSync(OUT)) {
    const prev = JSON.parse(fs.readFileSync(OUT, "utf-8")) as Array<{
      id: string;
      status: string;
    }>;
    for (const e of prev) {
      if (e.status !== "pending") existing[e.id] = e;
    }
    console.log(`📂 Loaded ${Object.keys(existing).length} existing non-pending entries`);
  }

  // 全力士をマージ
  const progress = data!.map((r) => {
    if (existing[r.id]) return existing[r.id];
    return {
      id: r.id,
      shikona: r.shikona,
      jsa_id: r.jsa_id,
      db_status: r.status,
      status: "pending",
      birth_date: null,
      active_from_basho: null,
      real_name: null,
      born_place: null,
      photo_url: null,
      fetched_at: null,
    };
  });

  const counts = {
    pending: progress.filter((e: any) => e.status === "pending").length,
    done: progress.filter((e: any) => e.status === "done").length,
    error: progress.filter((e: any) => e.status === "error").length,
    skip: progress.filter((e: any) => e.status === "skip").length,
  };

  fs.writeFileSync(OUT, JSON.stringify(progress, null, 2), "utf-8");
  console.log(`\n✅ Written to: ${OUT}`);
  console.log(`   pending: ${counts.pending}`);
  console.log(`   done:    ${counts.done}`);
  console.log(`   error:   ${counts.error}`);
  console.log(`   skip:    ${counts.skip}`);
}

main().catch(console.error);

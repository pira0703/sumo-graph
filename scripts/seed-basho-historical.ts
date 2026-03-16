/**
 * seed-basho-historical.ts
 * 場所マスタに 2000-01〜2026-01 の历史データを投入する
 * （2026-03 はすでに存在するためスキップ）
 *
 * 実行:
 *   op run --env-file=.env.local -- npx tsx scripts/seed-basho-historical.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ 環境変数が未設定");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── 場所名マッピング ────────────────────────────────────────────────────────

const MONTH_META: Record<number, { name: string; short: string; location: string }> = {
   1: { name: "初場所",    short: "初",    location: "東京"  },
   3: { name: "春場所",    short: "春",    location: "大阪"  },
   5: { name: "夏場所",    short: "夏",    location: "東京"  },
   7: { name: "名古屋場所", short: "名古屋", location: "名古屋" },
   9: { name: "秋場所",    short: "秋",    location: "東京"  },
  11: { name: "九州場所",  short: "九州",  location: "福岡"  },
};

// ─── レコード生成 ─────────────────────────────────────────────────────────────

function generateBashoRecords() {
  const records = [];
  for (let year = 2000; year <= 2026; year++) {
    const months = year === 2026 ? [1] : [1, 3, 5, 7, 9, 11];
    for (const month of months) {
      const id = `${year}-${String(month).padStart(2, "0")}`;
      const meta = MONTH_META[month];
      const yy = String(year).slice(2);
      records.push({
        id,
        name:       `${year}年${meta.name}`,
        short_name: `${yy}${meta.short}`,
        location:   meta.location,
        start_date: null,
        end_date:   null,
      });
    }
  }
  return records;
}

// ─── メイン ───────────────────────────────────────────────────────────────────

async function main() {
  const records = generateBashoRecords();
  console.log(`📋 生成レコード数: ${records.length} 件`);

  // UPSERT（既存レコードは上書きしない = ignoreDuplicates: true）
  const { error } = await supabase
    .from("basho")
    .upsert(records, { onConflict: "id", ignoreDuplicates: true });

  if (error) {
    console.error("❌ upsert エラー:", error.message);
    process.exit(1);
  }

  // 件数確認
  const { count } = await supabase
    .from("basho")
    .select("*", { count: "exact", head: true });

  console.log(`✅ 完了。basho テーブル合計: ${count} 件`);
  console.log("   (2026-03 は既存レコードなので ignoreDuplicates でスキップ済み)");
}

main();

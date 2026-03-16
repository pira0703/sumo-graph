/**
 * add-relationships.ts
 * 手動関係データを relationships テーブルに追加するスクリプト
 *
 * 実行:
 *   op run --env-file=.env.local -- npx tsx scripts/add-relationships.ts
 */
import { createClient } from "@supabase/supabase-js";

// op run --env-file=.env.local -- npx tsx scripts/add-relationships.ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// 追加したい手動関係の定義
// relation_type: "親子" | "兄弟弟子" | "家族"
const MANUAL_RELATIONS = [
  {
    a: "若元春",
    b: "若隆景",
    type: "兄弟弟子",
    desc: "実の兄弟（三浦兄弟）。若浪を父に持つ。",
  },
  // ここに追加する場合は上記の形式でどうぞ
] as const;

async function findRikishi(shikona: string) {
  const { data, error } = await supabase
    .from("rikishi")
    .select("id, shikona")
    .eq("shikona", shikona)
    .single();
  if (error || !data) {
    console.error(`❌ 見つからない: ${shikona} (${error?.message})`);
    return null;
  }
  return data;
}

async function main() {
  console.log("=== 手動関係データ投入 ===\n");

  for (const rel of MANUAL_RELATIONS) {
    console.log(`処理中: ${rel.a} ↔ ${rel.b} (${rel.type})`);

    const rikishiA = await findRikishi(rel.a);
    const rikishiB = await findRikishi(rel.b);

    if (!rikishiA || !rikishiB) {
      console.log(`  ⚠️  スキップ\n`);
      continue;
    }

    // 既存チェック（重複防止）
    const { data: existing } = await supabase
      .from("relationships")
      .select("id")
      .or(
        `and(rikishi_a_id.eq.${rikishiA.id},rikishi_b_id.eq.${rikishiB.id}),` +
        `and(rikishi_a_id.eq.${rikishiB.id},rikishi_b_id.eq.${rikishiA.id})`
      )
      .eq("relation_type", rel.type)
      .maybeSingle();

    if (existing) {
      console.log(`  ℹ️  既に存在 (id: ${existing.id}) → スキップ\n`);
      continue;
    }

    const { error } = await supabase.from("relationships").insert({
      rikishi_a_id: rikishiA.id,
      rikishi_b_id: rikishiB.id,
      relation_type: rel.type,
      description: rel.desc,
    });

    if (error) {
      console.error(`  ❌ エラー: ${error.message}\n`);
    } else {
      console.log(`  ✅ 追加成功: ${rel.a}(${rikishiA.id}) ↔ ${rel.b}(${rikishiB.id})\n`);
    }
  }

  console.log("=== 完了 ===");
}

main().catch(console.error);

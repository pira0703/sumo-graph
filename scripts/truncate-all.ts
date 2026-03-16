/**
 * truncate-all.ts
 * 全テーブルを CASCADE で一括 TRUNCATE し、クリーンな状態にする。
 * シード実行前の準備用スクリプト。
 *
 * 実行:
 *   op run --env-file=.env.local -- npx tsx scripts/truncate-all.ts
 */

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("🗑️  全テーブル TRUNCATE 開始...\n");

  // FK 依存順: 子→親 の順に TRUNCATE (CASCADE で一括でもOK)
  const tables = [
    "banzuke",
    "shikona_history",
    "relationships",
    "rikishi",
    "heya",
    "oyakata_master",
    "basho",
  ];

  for (const table of tables) {
    // Supabase JS の .delete() は WHERE 必須なので rpc で raw SQL を使う
    const { error } = await sb.rpc("exec_sql", {
      sql: `TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE;`,
    });

    // rpc が使えない場合は全件 DELETE で代用
    if (error) {
      const { error: delErr } = await sb.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (delErr) {
        // basho は id が TEXT なのでフォールバック
        const { error: delErr2 } = await (sb.from(table) as any).delete().not("id", "is", null);
        if (delErr2) {
          console.error(`❌ ${table} 削除エラー:`, delErr2.message);
        } else {
          console.log(`   ✅ ${table} クリア（TEXT id）`);
        }
      } else {
        console.log(`   ✅ ${table} クリア`);
      }
    } else {
      console.log(`   ✅ ${table} TRUNCATE 完了`);
    }
  }

  // 最終確認
  console.log("\n🔍 件数確認...");
  for (const table of tables) {
    const { count } = await (sb.from(table) as any).select("id", { count: "exact", head: true });
    const icon = (count ?? 0) === 0 ? "✅" : "⚠️ ";
    console.log(`   ${icon} ${table}: ${count ?? 0} 件`);
  }

  console.log("\n✅ 全テーブル クリア完了");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

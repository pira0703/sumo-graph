/**
 * upsert-banzuke-history.ts
 * Phase 5-C Task B: banzuke_history_progress.json から
 * 現役力士の関取歴データを banzuke テーブルへ UPSERT する。
 *
 * 【実行手順】
 * 1. dry-run で件数・サンプルを確認:
 *    DRY_RUN=true op run --env-file=.env.local -- npx tsx scripts/upsert-banzuke-history.ts
 *
 * 2. 本番実行:
 *    DRY_RUN=false op run --env-file=.env.local -- npx tsx scripts/upsert-banzuke-history.ts
 *
 * 【安全設計】
 * - DRY_RUN=true がデフォルト（誤実行防止）
 * - ignoreDuplicates=true で既存レコード（2026-03 等）を保護（DO NOTHING）
 * - bashoマスタに存在しない場所は警告してスキップ（FK制約違反防止）
 * - 不明な rank_class はエラーログに記録（サイレント無視禁止）
 * - 全投入後に basho 別件数を検証
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 環境変数が未設定 (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

const PROGRESS_FILE = path.join(__dirname, 'data', 'banzuke_history_progress.json');
const DRY_RUN       = process.env.DRY_RUN !== 'false'; // デフォルト true（安全設計）
const BATCH_SIZE    = 100;

const VALID_RANK_CLASSES = new Set([
  'yokozuna', 'ozeki', 'sekiwake', 'komusubi', 'maegashira', 'juryo',
]);

interface BanzukeRecord {
  basho:        string;
  rank_class:   string;
  rank_number:  number | null;
  rank_side:    string | null;
  rank_display: string;
}

interface ProgressEntry {
  rikishi_id:      string;
  jsa_id:          number;
  shikona:         string;
  status:          'pending' | 'done' | 'error';
  banzuke_records: BanzukeRecord[];
  error:           string | null;
  fetched_at:      string | null;
}

interface BanzukeRow {
  rikishi_id:   string;
  basho:        string;
  rank_class:   string;
  rank_number:  number | null;
  rank_side:    string | null;
  rank_display: string;
}

async function main() {
  console.log('=== upsert-banzuke-history (Phase 5-C Task B) ===');
  console.log(`DRY_RUN: ${DRY_RUN} (本番実行するには DRY_RUN=false を指定)`);
  console.log();

  // ① 進捗ファイル読み込み
  if (!fs.existsSync(PROGRESS_FILE)) {
    console.error(`❌ 進捗ファイルが見つかりません: ${PROGRESS_FILE}`);
    console.error('先に fetch_banzuke_history.py を実行してください。');
    process.exit(1);
  }

  const progress: ProgressEntry[] = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  const done    = progress.filter(p => p.status === 'done');
  const errors  = progress.filter(p => p.status === 'error');
  const pending = progress.filter(p => p.status === 'pending');

  console.log(`進捗ファイル: ${progress.length}件`);
  console.log(`  done:    ${done.length}件`);
  console.log(`  error:   ${errors.length}件`);
  console.log(`  pending: ${pending.length}件`);
  if (pending.length > 0) {
    console.warn(`⚠️  pending が ${pending.length} 件残っています。全件完了後に実行することを推奨。`);
  }
  if (errors.length > 0) {
    console.warn(`⚠️  error が ${errors.length} 件あります:`);
    for (const e of errors.slice(0, 5)) {
      console.warn(`    ${e.shikona} (jsa_id=${e.jsa_id}): ${e.error}`);
    }
  }
  console.log();

  // ② INSERT レコードを生成
  const toInsert: BanzukeRow[] = [];
  const withRecords = done.filter(p => p.banzuke_records.length > 0);
  const noRecords   = done.filter(p => p.banzuke_records.length === 0);
  const unknownRankClasses: string[] = [];
  const bashoCount = new Map<string, number>();

  for (const entry of withRecords) {
    for (const rec of entry.banzuke_records) {
      // 不明な rank_class を記録
      if (!VALID_RANK_CLASSES.has(rec.rank_class)) {
        unknownRankClasses.push(`${entry.shikona} ${rec.basho}: ${rec.rank_class}`);
        continue;
      }
      toInsert.push({
        rikishi_id:   entry.rikishi_id,
        basho:        rec.basho,
        rank_class:   rec.rank_class,
        rank_number:  rec.rank_number ?? null,
        rank_side:    rec.rank_side   ?? null,
        rank_display: rec.rank_display,
      });
      bashoCount.set(rec.basho, (bashoCount.get(rec.basho) ?? 0) + 1);
    }
  }

  if (unknownRankClasses.length > 0) {
    console.warn(`⚠️  不明な rank_class（スキップ）: ${unknownRankClasses.length}件`);
    for (const s of unknownRankClasses.slice(0, 10)) console.warn(`    ${s}`);
    console.warn();
  }

  console.log(`関取歴あり:         ${withRecords.length} 名`);
  console.log(`関取歴なし:         ${noRecords.length} 名`);
  console.log(`総 INSERT レコード: ${toInsert.length} 件`);
  console.log();

  // ③ basho 別サマリー（件数多い順 TOP15）
  const sortedBasho = [...bashoCount.entries()].sort((a, b) => b[1] - a[1]);
  console.log('=== basho 別レコード数 TOP15 ===');
  for (const [basho, count] of sortedBasho.slice(0, 15)) {
    console.log(`  ${basho}: ${count} 名`);
  }
  console.log(`  （全 ${bashoCount.size} 場所）`);
  console.log();

  // ④ サンプル表示（最初の3名）
  console.log('=== サンプル（最初の3名）===');
  for (const entry of withRecords.slice(0, 3)) {
    const recs = entry.banzuke_records;
    console.log(`  ${entry.shikona} — ${recs.length} 場所`);
    for (const rec of recs.slice(0, 3)) {
      console.log(`    ${rec.basho} ${rec.rank_display} (${rec.rank_class})`);
    }
    if (recs.length > 3) console.log(`    ... 他 ${recs.length - 3} 場所`);
  }
  console.log();

  if (DRY_RUN) {
    console.log('========================================');
    console.log('DRY_RUN=true のため実際の INSERT はスキップ。');
    console.log('内容を確認後、本番実行:');
    console.log('  DRY_RUN=false op run --env-file=.env.local -- npx tsx scripts/upsert-banzuke-history.ts');
    console.log('========================================');
    return;
  }

  // ⑤ bashoマスタを確認（範囲外は FK 制約違反になるためスキップ）
  console.log('bashoマスタを確認中...');
  const { data: bashoMaster, error: bashoErr } = await supabase
    .from('basho')
    .select('id');
  if (bashoErr) {
    console.error('❌ bashoマスタ取得エラー:', bashoErr.message);
    process.exit(1);
  }
  const bashoSet = new Set((bashoMaster ?? []).map(b => b.id));
  console.log(`bashoマスタ: ${bashoSet.size} 件`);

  const unknownBasho = [...new Set(toInsert.map(r => r.basho))].filter(b => !bashoSet.has(b)).sort();
  if (unknownBasho.length > 0) {
    console.warn(`⚠️  bashoマスタに存在しない場所（スキップ）: ${unknownBasho.length} 件`);
    for (const b of unknownBasho.slice(0, 20)) console.warn(`    ${b}`);
  }

  const validInserts = toInsert.filter(r => bashoSet.has(r.basho));
  const skippedByBasho = toInsert.length - validInserts.length;
  if (skippedByBasho > 0) {
    console.log(`bashoマスタ範囲外スキップ: ${skippedByBasho} 件`);
  }
  console.log(`有効 INSERT 対象: ${validInserts.length} 件`);
  console.log();

  // ⑥ バッチ UPSERT（ignoreDuplicates=true → 既存レコードを保護）
  let successCount = 0;
  let errorCount   = 0;

  console.log('INSERT 開始...');
  for (let i = 0; i < validInserts.length; i += BATCH_SIZE) {
    const batch = validInserts.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('banzuke')
      .upsert(batch, {
        onConflict:       'rikishi_id,basho',
        ignoreDuplicates: true,  // ON CONFLICT DO NOTHING → 既存レコードを保護
      });

    if (error) {
      console.error(`❌ バッチエラー [${i}〜${i + batch.length - 1}]: ${error.message}`);
      errorCount += batch.length;
    } else {
      successCount += batch.length;
    }

    // 1000件ごと or 最終バッチで進捗表示
    const processed = Math.min(i + BATCH_SIZE, validInserts.length);
    if (processed % 1000 === 0 || processed === validInserts.length) {
      console.log(`  進捗: ${processed} / ${validInserts.length} 件`);
    }
  }

  console.log();
  console.log('=== 投入結果 ===');
  console.log(`INSERT 試行:  ${validInserts.length} 件`);
  console.log(`成功(上限):   ${successCount} 件`);
  console.log(`エラー:       ${errorCount} 件`);
  console.log();

  // ⑦ 検証: banzuke テーブルの basho 別件数
  console.log('=== 検証: banzuke テーブル basho 別件数（新しい順） ===');
  const { data: countData, error: countErr } = await supabase
    .from('banzuke')
    .select('basho')
    .order('basho', { ascending: false });

  if (countErr) {
    console.error('❌ 検証クエリエラー:', countErr.message);
  } else {
    const grouped = new Map<string, number>();
    for (const row of countData ?? []) {
      grouped.set(row.basho, (grouped.get(row.basho) ?? 0) + 1);
    }
    const sorted = [...grouped.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    for (const [basho, count] of sorted.slice(0, 20)) {
      console.log(`  ${basho}: ${count} 件`);
    }
    if (sorted.length > 20) {
      console.log(`  ...（全 ${sorted.length} 場所）`);
    }
    const total = [...grouped.values()].reduce((a, b) => a + b, 0);
    console.log();
    console.log(`  総件数: ${total} 件 / ${sorted.length} 場所`);
  }
}

main().catch(err => {
  console.error('予期せぬエラー:', err);
  process.exit(1);
});

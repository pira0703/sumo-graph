/**
 * upsert-missing-profiles.ts
 * missing_profiles_progress.json の done 済みデータを Supabase にUPSERT する。
 *
 * 【実行手順】
 * 1. dry-run で件数・サンプルを確認:
 *    DRY_RUN=true op run --env-file=.env.local -- npx tsx scripts/upsert-missing-profiles.ts
 *
 * 2. 本番実行:
 *    op run --env-file=.env.local -- npx tsx scripts/upsert-missing-profiles.ts
 *
 * 【安全設計】
 * - birth_date / active_from_basho が null の場合は上書きしない
 * - 既にDBに値が入っている場合も上書きしない（null の場合のみ更新）
 * - エラーは個別にログ出力し、他の処理を止めない
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase     = createClient(supabaseUrl, supabaseKey);

const PROGRESS_FILE = path.join(__dirname, 'data', 'missing_profiles_progress.json');
const DRY_RUN       = process.env.DRY_RUN !== 'false'; // デフォルトtrue（安全設計）
const BATCH_SIZE    = 50;

interface MissingProfileEntry {
  id:               string;
  shikona:          string;
  jsa_id:           number;
  status:           string;
  needs_birth_date: boolean;
  needs_debut:      boolean;
  birth_date:       string | null;
  active_from_basho: string | null;
  error:            string | null;
}

async function main() {
  console.log('=== upsert-missing-profiles ===');
  console.log(`DRY_RUN: ${DRY_RUN} (本番実行するには DRY_RUN=false を指定)`);
  console.log();

  // ①進捗ファイル読み込み
  if (!fs.existsSync(PROGRESS_FILE)) {
    console.error(`進捗ファイルが見つかりません: ${PROGRESS_FILE}`);
    console.error('先に fetch_missing_profiles.py を実行してください。');
    process.exit(1);
  }
  const progress: MissingProfileEntry[] = JSON.parse(
    fs.readFileSync(PROGRESS_FILE, 'utf-8')
  );

  const doneEntries = progress.filter(p => p.status === 'done');
  const errEntries  = progress.filter(p => p.status === 'error');
  const pending     = progress.filter(p => p.status === 'pending');
  console.log(`進捗ファイル: ${progress.length}件`);
  console.log(`  done:    ${doneEntries.length}件`);
  console.log(`  error:   ${errEntries.length}件`);
  console.log(`  pending: ${pending.length}件`);
  console.log();

  // ②更新対象を絞る（実際に値が取れているもの）
  const toUpdate = doneEntries.filter(p => {
    const willUpdateBirth = p.needs_birth_date && p.birth_date != null;
    const willUpdateDebut = p.needs_debut && p.active_from_basho != null;
    return willUpdateBirth || willUpdateDebut;
  });

  const noData = doneEntries.filter(p => {
    const willUpdateBirth = p.needs_birth_date && p.birth_date != null;
    const willUpdateDebut = p.needs_debut && p.active_from_basho != null;
    return !willUpdateBirth && !willUpdateDebut;
  });

  console.log(`更新対象 (データあり): ${toUpdate.length}件`);
  console.log(`データ取得できず (NULL):  ${noData.length}件`);
  console.log();

  // ③サンプル表示
  console.log('=== サンプル (最初の10件) ===');
  for (const entry of toUpdate.slice(0, 10)) {
    const updates: string[] = [];
    if (entry.needs_birth_date && entry.birth_date)
      updates.push(`birth_date=${entry.birth_date}`);
    if (entry.needs_debut && entry.active_from_basho)
      updates.push(`active_from_basho=${entry.active_from_basho}`);
    console.log(`  [${entry.jsa_id}] ${entry.shikona}: ${updates.join(', ')}`);
  }
  console.log();

  if (DRY_RUN) {
    console.log('========================================');
    console.log('DRY_RUN=true のため実際の更新はスキップ。');
    console.log('本番実行:');
    console.log('  DRY_RUN=false op run --env-file=.env.local -- npx tsx scripts/upsert-missing-profiles.ts');
    console.log('========================================');
    return;
  }

  // ④DBに既存値がある場合は上書きしないよう確認
  console.log('DBの既存値を確認中...');
  const ids = toUpdate.map(p => p.id);

  // バッチで取得
  const existingMap = new Map<string, { birth_date: string | null; active_from_basho: string | null }>();
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const { data, error } = await supabase
      .from('rikishi')
      .select('id, birth_date, active_from_basho')
      .in('id', batch);
    if (error) {
      console.error('DB確認エラー:', error.message);
      process.exit(1);
    }
    for (const row of data ?? []) {
      existingMap.set(row.id, {
        birth_date:        row.birth_date,
        active_from_basho: row.active_from_basho,
      });
    }
  }

  // ⑤バッチ更新
  let successCount = 0;
  let skipCount    = 0;
  let errorCount   = 0;

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);

    for (const entry of batch) {
      const existing = existingMap.get(entry.id);
      const updateData: Record<string, string> = {};

      // birth_date: DBに既存値がない場合のみ更新
      if (entry.needs_birth_date && entry.birth_date) {
        if (!existing?.birth_date) {
          updateData.birth_date = entry.birth_date;
        } else {
          // 既存値がある場合はスキップ（上書きしない）
        }
      }

      // active_from_basho: DBに既存値がない場合のみ更新
      if (entry.needs_debut && entry.active_from_basho) {
        if (!existing?.active_from_basho) {
          updateData.active_from_basho = entry.active_from_basho;
        }
      }

      if (Object.keys(updateData).length === 0) {
        skipCount++;
        continue;
      }

      const { error } = await supabase
        .from('rikishi')
        .update(updateData)
        .eq('id', entry.id);

      if (error) {
        console.error(`  ❌ ${entry.shikona} (${entry.id}): ${error.message}`);
        errorCount++;
      } else {
        successCount++;
      }
    }

    const processed = Math.min(i + BATCH_SIZE, toUpdate.length);
    console.log(`  バッチ完了: ${processed} / ${toUpdate.length}`);
  }

  // ⑥サマリー
  console.log();
  console.log('=== 結果 ===');
  console.log(`成功:   ${successCount}件`);
  console.log(`スキップ (DB既存値あり): ${skipCount}件`);
  console.log(`エラー: ${errorCount}件`);
}

main().catch(err => {
  console.error('予期せぬエラー:', err);
  process.exit(1);
});

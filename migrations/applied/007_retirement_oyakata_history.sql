-- ⚠️ 適用済み（APPLIED）- 再実行不可
-- =============================================
-- Migration: Add retirement status & oyakata_name_history
-- 2026-03-11
-- Run in Supabase SQL Editor
-- =============================================
--
-- 追加内容:
--   1. rikishi に status / heya_role / retirement_date カラム追加
--   2. oyakata_name_history テーブル（名跡保有の時系列）
--   3. 既存データ移行（active_to IS NOT NULL → status='retired'）
--   4. 既存の oyakata_id から初期履歴レコード生成
--
-- 実行順序: このファイルは migration_add_oyakata_master.sql の後に実行すること
-- =============================================

-- ─── 1. rikishi に引退状態管理カラム追加 ─────────────────────────────────────
ALTER TABLE rikishi
  ADD COLUMN IF NOT EXISTS status          TEXT NOT NULL DEFAULT 'active'
    CONSTRAINT rikishi_status_check CHECK (status IN ('active', 'retired')),
  ADD COLUMN IF NOT EXISTS heya_role       TEXT
    CONSTRAINT rikishi_heya_role_check CHECK (heya_role IN ('shisho', 'tsuke_oyakata')),
  ADD COLUMN IF NOT EXISTS retirement_date DATE;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_rikishi_status ON rikishi(status);

-- 既存データ移行: active_to が設定されている力士を retired に更新
UPDATE rikishi
  SET status = 'retired'
  WHERE active_to IS NOT NULL;

-- ─── 2. 年寄名跡保有履歴テーブル ──────────────────────────────────────────────
-- 一人の力士が複数の名跡を時系列で保有する場合に対応
-- 例: 照ノ富士 → 伊勢ヶ濱 継承（旭富士の定年退職後）
-- 例: 花田虎上 → 若乃花 → 間垣（2001年） → 再び間垣（2009年）
CREATE TABLE IF NOT EXISTS oyakata_name_history (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rikishi_id        UUID NOT NULL REFERENCES rikishi(id) ON DELETE CASCADE,
  oyakata_master_id UUID NOT NULL REFERENCES oyakata_master(id),
  start_date        DATE NOT NULL,
  end_date          DATE,     -- NULL = 現在保有中
  reason            TEXT,     -- '就任' | '名跡移転' | '定年返上' | '退職' | '死亡' | 'その他'
  notes             TEXT,     -- 備考（前任者名・経緯など）
  created_at        TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT oyakata_history_date_order CHECK (end_date IS NULL OR end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_oyakata_name_history_rikishi
  ON oyakata_name_history(rikishi_id);
CREATE INDEX IF NOT EXISTS idx_oyakata_name_history_master
  ON oyakata_name_history(oyakata_master_id);
-- 現在保有中（end_date IS NULL）の高速検索用
CREATE INDEX IF NOT EXISTS idx_oyakata_name_history_current
  ON oyakata_name_history(rikishi_id) WHERE end_date IS NULL;

-- RLS
ALTER TABLE oyakata_name_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read oyakata_name_history"
  ON oyakata_name_history FOR SELECT USING (true);

-- ─── 3. 既存 oyakata_id から初期履歴レコード生成 ─────────────────────────────
-- 照ノ富士（伊勢ヶ濱）が oyakata_id 設定済みのため、その履歴を初期登録
INSERT INTO oyakata_name_history (rikishi_id, oyakata_master_id, start_date, reason, notes)
SELECT
  r.id,
  r.oyakata_id,
  COALESCE(r.retirement_date, '2024-09-29'::DATE),
  '就任',
  '初期データ移行'
FROM rikishi r
WHERE r.oyakata_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM oyakata_name_history h WHERE h.rikishi_id = r.id
  );

-- ─── 4. 照ノ富士のデータ補完 ─────────────────────────────────────────────────
-- retirement_date / heya_role を補完（oyakata_id が設定済みで status が active のもの）
UPDATE rikishi
  SET
    status          = 'retired',
    retirement_date = '2024-09-29',
    heya_role       = 'shisho',
    active_to       = COALESCE(active_to, 2024)
  WHERE oyakata_id IS NOT NULL
    AND status = 'active';

-- ─── 確認クエリ ───────────────────────────────────────────────────────────────
-- SELECT status, COUNT(*) FROM rikishi GROUP BY status ORDER BY status;
-- SELECT COUNT(*) FROM oyakata_name_history;
-- SELECT r.shikona, om.name AS oyakata_name, h.start_date, h.end_date, h.reason
--   FROM oyakata_name_history h
--   JOIN rikishi r ON r.id = h.rikishi_id
--   JOIN oyakata_master om ON om.id = h.oyakata_master_id
--   ORDER BY h.start_date;

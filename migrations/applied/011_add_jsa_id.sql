-- ============================================================
-- Migration 011: rikishi テーブルに jsa_id カラムを追加
-- 実行前提: なし（単純なカラム追加）
-- 実行日: 未適用 → 適用後は applied/ に移動すること
-- ============================================================

ALTER TABLE rikishi
  ADD COLUMN jsa_id INTEGER UNIQUE;

-- インデックスも追加（name マッチング & 高速ルックアップ用）
CREATE INDEX IF NOT EXISTS idx_rikishi_jsa_id ON rikishi (jsa_id);

-- 確認クエリ（実行後に動作確認として使用）
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'rikishi' AND column_name = 'jsa_id';

-- ============================================================
-- 010_retirement_basho.sql
-- 目的: 引退情報を basho マスタ参照に統一
--   1. retirement_basho TEXT REFERENCES basho(id) を追加
--   2. active_to INT を削除（status カラムで代替）
--   3. retirement_date DATE を削除（retirement_basho で代替）
--
-- ⚠️ 実行前提: basho マスタに該当レコードが存在すること
-- ⚠️ 実行方法: Supabase Dashboard > SQL Editor で実行
-- ============================================================

-- 1. 新カラム追加
ALTER TABLE rikishi
  ADD COLUMN retirement_basho TEXT REFERENCES basho(id);

-- 2. 旧カラム削除
ALTER TABLE rikishi
  DROP COLUMN active_to,
  DROP COLUMN retirement_date;

-- 確認クエリ（コメントアウト解除して実行可）
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'rikishi'
-- ORDER BY ordinal_position;

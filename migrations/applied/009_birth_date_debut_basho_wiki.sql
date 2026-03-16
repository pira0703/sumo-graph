-- ============================================================
-- migration: 002_birth_date_debut_basho_wiki.sql
-- 目的: rikishi テーブルのスキーマ修正
--   1. born_year INT → birth_date DATE（生年月日に精度向上）
--   2. active_from INT → active_from_basho TEXT REFERENCES basho(id)
--   3. wikipedia_title TEXT → wiki_url TEXT
--
-- ⚠️ 実行前提: scripts/seed-basho-historical.ts を先に実行して
--              basho マスタに過去レコードが存在すること
-- ⚠️ 実行方法: Supabase Dashboard > SQL Editor で実行
-- ============================================================

-- 1. 新カラム追加
ALTER TABLE rikishi
  ADD COLUMN birth_date        DATE,
  ADD COLUMN active_from_basho TEXT REFERENCES basho(id),
  ADD COLUMN wiki_url          TEXT;

-- 2. 旧カラム削除（全レコード NULL 状態なので安全）
ALTER TABLE rikishi
  DROP COLUMN born_year,
  DROP COLUMN active_from,
  DROP COLUMN wikipedia_title;

-- 確認クエリ（コメントアウト解除して実行可）
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'rikishi'
-- ORDER BY ordinal_position;

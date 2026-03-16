-- ============================================================
-- 001_add_shisho_id.sql
-- ⚠️ 適用済み（APPLIED）- 再実行不可
-- ⚠️ 元ファイルにあった TRUNCATE TABLE 文は削除済み（データ消去防止）
-- ============================================================
-- Migration: Add shisho_id to rikishi table
-- Run this in Supabase SQL Editor BEFORE running seed-makuuchi.ts

-- 1. shisho_idカラム追加（自己参照FK）
ALTER TABLE rikishi
  ADD COLUMN IF NOT EXISTS shisho_id UUID REFERENCES rikishi(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rikishi_shisho ON rikishi(shisho_id);



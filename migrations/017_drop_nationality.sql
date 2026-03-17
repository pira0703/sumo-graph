-- Migration 017: nationality カラムを rikishi テーブルから削除
-- born_place（出身地）で十分なため不要
ALTER TABLE rikishi DROP COLUMN IF EXISTS nationality;

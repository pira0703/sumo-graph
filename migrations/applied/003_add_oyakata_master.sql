-- ⚠️ 適用済み（APPLIED）- 再実行不可
-- =============================================
-- Migration: Add oyakata_master table
-- 2026-03-11
-- Run in Supabase SQL Editor
-- =============================================
-- 親方株（年寄名跡）マスタテーブル
-- 日本相撲協会が管理する105の年寄名跡を管理する
--
-- 特殊ケース:
--   is_ichidai_toshiyori = true:
--     横綱引退時に特別功績が認められた場合に現役四股名をそのまま使用する「一代年寄」
--     例: 大鵬、北の湖、貴乃花（千代の富士は辞退）
--     ※105名跡とは別枠。一代限りで譲渡・継承不可
--
--   一代年寄でない横綱の現役名年寄（現役名で猶予期間中）は通常の名跡を取得するまでの
--   暫定措置であり、本テーブルの is_ichidai_toshiyori とは無関係。
--   例: 照ノ富士は「伊勢ヶ濱」を正式襲名済み（現役名年寄でも一代年寄でもない）
-- =============================================

CREATE TABLE IF NOT EXISTS oyakata_master (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name                  TEXT NOT NULL UNIQUE,       -- 名跡名 例: 伊勢ヶ濱
  yomigana              TEXT,                        -- ひらがな読み 例: いせがはま
  ichimon               TEXT,                        -- 所属一門 例: 二所ノ関一門
  is_ichidai_toshiyori  BOOLEAN NOT NULL DEFAULT false,  -- 一代年寄フラグ
  notes                 TEXT,                        -- 備考（一代年寄の場合は元横綱名など）
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_oyakata_master_ichimon
  ON oyakata_master(ichimon);
CREATE INDEX IF NOT EXISTS idx_oyakata_master_ichidai
  ON oyakata_master(is_ichidai_toshiyori) WHERE is_ichidai_toshiyori = true;

-- RLS
ALTER TABLE oyakata_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read oyakata_master"
  ON oyakata_master FOR SELECT USING (true);

-- ─── rikishi テーブルに oyakata_id を追加（将来の FK 移行用）──────────────────
-- 現在は oyakata_name (TEXT) で管理しているが、将来的には
-- oyakata_id (UUID FK) に移行することを想定してカラムを追加しておく
-- 移行が完了したら oyakata_name カラムは DROP 予定

ALTER TABLE rikishi
  ADD COLUMN IF NOT EXISTS oyakata_id UUID REFERENCES oyakata_master(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rikishi_oyakata
  ON rikishi(oyakata_id);

-- ─── 確認クエリ ───────────────────────────────────────────────────────────────
-- SELECT name, ichimon, is_ichidai_toshiyori FROM oyakata_master ORDER BY ichimon, name;
-- SELECT COUNT(*) FROM oyakata_master;  -- 105 (+ 一代年寄数件) を確認

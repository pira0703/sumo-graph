-- ⚠️ 適用済み（APPLIED）- 再実行不可
-- =============================================
-- Migration: Add shikona_history & banzuke
-- 2026-03-11
-- Run in Supabase SQL Editor
-- =============================================

-- ─── 1. shikona_history テーブル ─────────────────────────────────────────────
-- 四股名の変遷を時系列で管理（琴ノ若→琴桜 などの改名に対応）

CREATE TABLE IF NOT EXISTS shikona_history (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rikishi_id  UUID NOT NULL REFERENCES rikishi(id) ON DELETE CASCADE,
  shikona     TEXT NOT NULL,
  yomigana    TEXT,
  valid_from  DATE,    -- この四股名を使い始めた日（NULL=最初から）
  valid_to    DATE,    -- この四股名をやめた日（NULL=現在も使用中）
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shikona_history_rikishi
  ON shikona_history(rikishi_id);
CREATE INDEX IF NOT EXISTS idx_shikona_history_valid_to
  ON shikona_history(valid_to) WHERE valid_to IS NULL;

-- RLS
ALTER TABLE shikona_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read shikona_history"
  ON shikona_history FOR SELECT USING (true);

-- ─── 2. banzuke テーブル ──────────────────────────────────────────────────────
-- 各場所の番付を時系列で管理
-- 現役力士→直近場所の番付を表示 / 引退力士→最高位を別途 highest_rank で保持

CREATE TABLE IF NOT EXISTS banzuke (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rikishi_id   UUID NOT NULL REFERENCES rikishi(id) ON DELETE CASCADE,
  basho        TEXT NOT NULL,    -- '2026-03' (年-場所月: 01,03,05,07,09,11)
  rank_class   TEXT NOT NULL,    -- 'yokozuna','ozeki','sekiwake','komusubi','maegashira','juryo'
  rank_number  INT,              -- 1,2,3... (横綱1など)
  rank_side    TEXT,             -- 'east','west'
  rank_display TEXT,             -- 'Y1e','O2w','M14e' など（表示用）
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (rikishi_id, basho),
  CHECK (rank_class IN ('yokozuna','ozeki','sekiwake','komusubi','maegashira','juryo',
                        'makushita','sandanme','jonidan','jonokuchi'))
);

CREATE INDEX IF NOT EXISTS idx_banzuke_rikishi
  ON banzuke(rikishi_id);
CREATE INDEX IF NOT EXISTS idx_banzuke_basho
  ON banzuke(basho);
CREATE INDEX IF NOT EXISTS idx_banzuke_rikishi_basho
  ON banzuke(rikishi_id, basho DESC);

-- RLS
ALTER TABLE banzuke ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read banzuke"
  ON banzuke FOR SELECT USING (true);

-- ─── 3. rikishi テーブルに oyakata_name カラムを追加 ──────────────────────────
-- 引退後に教会に残る親方の名前（親方株の名称）
-- 将来的には oyakata_name マスタテーブルへの FK にする

ALTER TABLE rikishi
  ADD COLUMN IF NOT EXISTS oyakata_name TEXT;

-- ─── 確認クエリ ───────────────────────────────────────────────────────────────
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   ORDER BY table_name;

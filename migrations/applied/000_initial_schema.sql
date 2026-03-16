-- ============================================================
-- 000_initial_schema.sql
-- ⚠️ 適用済み（APPLIED）- 再実行不可
-- このファイルはプロジェクト初期のスキーマ定義。
-- 以降の migration で多くのカラムが変更・削除されており、
-- 現在の DB 状態とは一致しない。参照用として保存。
-- ============================================================
-- =============================================
-- sumo-graph Supabase Schema
-- =============================================

-- 部屋テーブル
CREATE TABLE heya (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  ichimon     TEXT,                    -- 出羽海一門, 二所ノ関一門, etc.
  created_year INT,
  closed_year  INT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 力士テーブル
CREATE TABLE rikishi (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shikona          TEXT NOT NULL,       -- 四股名
  yomigana         TEXT,               -- ひらがな読み
  real_name        TEXT,               -- 本名
  heya_id          UUID REFERENCES heya(id),
  born_place       TEXT,               -- 出身地（都道府県 or 国）
  born_year        INT,
  highest_rank     TEXT,               -- 最高位
  active_from      INT,                -- 初土俵（年）
  active_to        INT,                -- 引退年（NULLなら現役）
  nationality      TEXT DEFAULT '日本',
  school           TEXT,               -- 出身高校・中学
  episodes         TEXT,               -- エピソード・豆知識
  photo_url        TEXT,               -- 顔写真URL
  wikipedia_title  TEXT,               -- Wikipedia記事タイトル
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 関係テーブル
CREATE TABLE relationships (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rikishi_a_id UUID NOT NULL REFERENCES rikishi(id) ON DELETE CASCADE,
  rikishi_b_id UUID NOT NULL REFERENCES rikishi(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK (
    relation_type IN ('師弟','親子','兄弟弟子','同部屋','同郷','同学校','家族','同一門')
  ),
  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT no_self_relation CHECK (rikishi_a_id <> rikishi_b_id)
);

-- インデックス
CREATE INDEX idx_rikishi_heya    ON rikishi(heya_id);
CREATE INDEX idx_rikishi_rank    ON rikishi(highest_rank);
CREATE INDEX idx_rikishi_active  ON rikishi(active_to);
CREATE INDEX idx_rel_a           ON relationships(rikishi_a_id);
CREATE INDEX idx_rel_b           ON relationships(rikishi_b_id);
CREATE INDEX idx_rel_type        ON relationships(relation_type);

-- RLS（認証なし→全読み取りOK、書き込みはService Roleのみ）
ALTER TABLE heya         ENABLE ROW LEVEL SECURITY;
ALTER TABLE rikishi      ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read heya"          ON heya         FOR SELECT USING (true);
CREATE POLICY "public read rikishi"       ON rikishi      FOR SELECT USING (true);
CREATE POLICY "public read relationships" ON relationships FOR SELECT USING (true);

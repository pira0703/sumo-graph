-- ⚠️ 未適用
-- 師匠履歴テーブル（shisho_id 単一カラムの暫定実装を時系列管理に昇格）
--
-- 目的:
--   部屋の師匠交代が起きたとき、過去の師弟関係が消えないよう
--   rikishi_shisho テーブルで時系列管理する。
--   rikishi.shisho_id は「現在の師匠」の簡易参照として残す。
--
-- 適用手順:
--   1. Supabase Dashboard > SQL Editor でこのファイルの中身を実行
--   2. 実行後 applied/ に移動: mv migrations/016_*.sql migrations/applied/

CREATE TABLE IF NOT EXISTS rikishi_shisho (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rikishi_id   UUID        NOT NULL REFERENCES rikishi(id) ON DELETE CASCADE,
  shisho_id    UUID        NOT NULL REFERENCES rikishi(id) ON DELETE RESTRICT,
  from_basho   TEXT        REFERENCES basho(id),  -- NULL = 不明
  to_basho     TEXT        REFERENCES basho(id),  -- NULL = 現在も継続
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT rikishi_shisho_no_self CHECK (rikishi_id <> shisho_id)
);

CREATE INDEX IF NOT EXISTS idx_rikishi_shisho_rikishi ON rikishi_shisho(rikishi_id);
CREATE INDEX IF NOT EXISTS idx_rikishi_shisho_shisho  ON rikishi_shisho(shisho_id);

-- RLS: 読み取りは全員、書き込みは認証ユーザーのみ
ALTER TABLE rikishi_shisho ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rikishi_shisho_select" ON rikishi_shisho
  FOR SELECT USING (true);

CREATE POLICY "rikishi_shisho_insert" ON rikishi_shisho
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "rikishi_shisho_update" ON rikishi_shisho
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "rikishi_shisho_delete" ON rikishi_shisho
  FOR DELETE USING (auth.role() = 'authenticated');

-- Migration 018: えにし N:N グループ設計
-- relationships テーブル（手動えにし専用、0レコード）を廃止し
-- enishi / enishi_members で N:N を表現する

-- ─── 旧テーブル削除 ───────────────────────────────────────────────────────────
DROP TABLE IF EXISTS relationships;

-- ─── えにし（縁グループ） ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enishi (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relation_type TEXT NOT NULL,     -- 自由入力: "ライバル" "幼馴染" etc.
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── えにしメンバー（N:N） ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enishi_members (
  enishi_id  UUID NOT NULL REFERENCES enishi(id) ON DELETE CASCADE,
  rikishi_id UUID NOT NULL REFERENCES rikishi(id) ON DELETE CASCADE,
  PRIMARY KEY (enishi_id, rikishi_id)
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE enishi ENABLE ROW LEVEL SECURITY;
ALTER TABLE enishi_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enishi_select_all"   ON enishi FOR SELECT USING (true);
CREATE POLICY "enishi_insert_auth"  ON enishi FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "enishi_update_auth"  ON enishi FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "enishi_delete_auth"  ON enishi FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "enishi_members_select_all"  ON enishi_members FOR SELECT USING (true);
CREATE POLICY "enishi_members_insert_auth" ON enishi_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "enishi_members_delete_auth" ON enishi_members FOR DELETE USING (auth.uid() IS NOT NULL);

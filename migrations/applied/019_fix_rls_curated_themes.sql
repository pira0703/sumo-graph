-- ============================================================
-- 019_fix_rls_curated_themes.sql
-- curated_themes テーブルに RLS を追加
-- Supabase Security Advisor の "1 error" 対応
-- 適用後は migrations/applied/ に移動すること
-- ============================================================

-- RLS を有効化
ALTER TABLE curated_themes ENABLE ROW LEVEL SECURITY;

-- 誰でも読み取り可（グラフ画面でテーマを表示するため）
CREATE POLICY "curated_themes_select_all"
  ON curated_themes FOR SELECT USING (true);

-- 書き込みは認証済みユーザー（= admin / editor）のみ
CREATE POLICY "curated_themes_insert_auth"
  ON curated_themes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "curated_themes_update_auth"
  ON curated_themes FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "curated_themes_delete_auth"
  ON curated_themes FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 015_add_editor_role.sql
-- profiles.role に 'editor' を追加
-- ⚠️ 適用後は migrations/applied/ に移動すること（再実行禁止）
-- ============================================================

-- CHECK 制約を差し替え（editor を追加）
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'editor', 'paid', 'user'));

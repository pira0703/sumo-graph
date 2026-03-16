-- ⚠️ 適用済み（APPLIED）- 再実行不可
-- migration: rikishi テーブルに high_school / university カラムを追加
-- 既存の school カラムは残しつつ、新規カラムを追加する

ALTER TABLE rikishi
  ADD COLUMN IF NOT EXISTS high_school text,
  ADD COLUMN IF NOT EXISTS university  text;

-- 既存データの移行: school カラムの値を university にコピー
-- （既存の school は大学名が多いため university に移行）
-- ※ 高校のみの力士は手動で high_school カラムに移動してください
UPDATE rikishi SET university = school WHERE school IS NOT NULL AND university IS NULL;

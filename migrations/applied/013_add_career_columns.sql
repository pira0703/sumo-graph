-- ============================================================
-- 013_add_career_columns.sql
-- rikishi テーブルにキャリア分類カラムを追加
-- 適用後は migrations/applied/ に移動すること
-- ============================================================

ALTER TABLE rikishi
  ADD COLUMN IF NOT EXISTS career_trend     TEXT,
  ADD COLUMN IF NOT EXISTS career_stage     TEXT,
  ADD COLUMN IF NOT EXISTS promotion_speed  TEXT;

COMMENT ON COLUMN rikishi.career_trend
  IS '直近5場所の番付トレンド: rising | stable | declining | volatile (NULL = 関取歴なし)';
COMMENT ON COLUMN rikishi.career_stage
  IS '関取キャリアステージ: veteran(30場所以上) | mid(15〜29) | new(1〜14) (NULL = 関取歴なし)';
COMMENT ON COLUMN rikishi.promotion_speed
  IS '初土俵→初関取の速さ: fast(〜10場所) | normal(11〜20) | late(21場所〜) (NULL = 関取経験なし)';

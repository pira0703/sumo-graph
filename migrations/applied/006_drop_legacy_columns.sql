-- ⚠️ 適用済み（APPLIED）- 再実行不可
-- Drop legacy columns that have been migrated to new fields
-- school → high_school / university (migration_add_school_fields.sql で移行済み)
-- oyakata_name は oyakata_id に統合済み（未使用）

ALTER TABLE rikishi DROP COLUMN IF EXISTS school;
ALTER TABLE rikishi DROP COLUMN IF EXISTS oyakata_name;

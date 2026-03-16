-- ⚠️ 適用済み（APPLIED）- 再実行不可
-- migration: relationships テーブルの relation_type 値を更新
-- 「親子」→「親子・兄弟」、「家族」→「親族」

UPDATE relationships
  SET relation_type = '親子・兄弟'
  WHERE relation_type = '親子';

UPDATE relationships
  SET relation_type = '親族'
  WHERE relation_type = '家族';

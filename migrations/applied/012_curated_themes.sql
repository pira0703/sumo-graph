-- ============================================================
-- 012_curated_themes.sql
-- キュレーションテーママスタテーブル
-- 適用後は migrations/applied/ に移動すること
-- ============================================================

CREATE TABLE IF NOT EXISTS curated_themes (
  id             TEXT        PRIMARY KEY,
  emoji          TEXT        NOT NULL DEFAULT '🏆',
  label          TEXT        NOT NULL,
  description    TEXT        NOT NULL DEFAULT '',
  filter_config  JSONB       NOT NULL DEFAULT '{}',
  show_all_ranks BOOLEAN     NOT NULL DEFAULT false,
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 既存の静的テーマを DB に移行（重複時はスキップ）
INSERT INTO curated_themes (id, emoji, label, description, filter_config, show_all_ranks, sort_order) VALUES
  ('mongolia',    '🌏', 'モンゴルの覇者たち',    '国外出身力士たちの同郷ネットワーク',
    '{"era":"現役","regions":["国外"],"relation_types":["同郷"]}',
    false, 1),
  ('university',  '🎓', '大学相撲の絆',          '同じ大学で競い合った仲間たち',
    '{"era":"現役","educations":["大卒"],"relation_types":["土俵の青春（同大学）"]}',
    false, 2),
  ('kyushu',      '🍜', '九州の荒波',            '九州・沖縄出身力士の同郷つながり',
    '{"era":"現役","regions":["九州・沖縄"],"relation_types":["同郷"]}',
    false, 3),
  ('kinki',       '🏯', '近畿の猛者',            '近畿出身力士たちの同郷ネットワーク',
    '{"era":"現役","regions":["近畿"],"relation_types":["同郷"]}',
    false, 4),
  ('youngsters',  '⚡', '若武者の台頭',          '10代・20代前半の若手力士たちの部屋つながり',
    '{"era":"現役","ageGroups":["10代","20代前半"],"relation_types":["兄弟弟子"]}',
    true, 5),
  ('highschool',  '🏟', '高校相撲の精鋭',        '高校相撲出身力士たちの同窓ネットワーク',
    '{"era":"現役","educations":["高卒"],"relation_types":["土俵の青春（同高校）"]}',
    false, 6),
  ('tohoku',      '❄️', '東北・北海道の誇り',    '北の大地出身力士たちの同郷つながり',
    '{"era":"現役","regions":["北海道・東北"],"relation_types":["同郷"]}',
    false, 7),
  ('kanto',       '🗼', '関東の力士たち',        '関東・甲信越出身力士の全関係を俯瞰する',
    '{"era":"現役","regions":["関東・甲信越"],"relation_types":["同郷"]}',
    false, 8),
  ('chubu_kinki', '🌊', '中部・近畿の精鋭',      '中部・近畿出身力士の全関係を俯瞰する',
    '{"era":"現役","regions":["中部","近畿"],"relation_types":["同郷"]}',
    false, 9)
ON CONFLICT (id) DO NOTHING;

import type { FilterState } from "@/types";

export interface CuratedTheme {
  id: string;
  emoji: string;
  label: string;
  description: string;
  /** API + クライアントフィルターへ上書きする値 */
  filter: Partial<FilterState>;
  /** @deprecated showAllRanks は applyTheme() で rankDivisions=[] に変換される */
  showAllRanks: boolean;
}

export const CURATED_THEMES: CuratedTheme[] = [
  // ─── 地域・出身系 ──────────────────────────────────────────────────────────
  {
    id: "mongolia",
    emoji: "🌏",
    label: "モンゴルの覇者たち",
    description: "22名・関取輩出率50%。草原の国から来た男たちの同郷ネットワーク",
    filter: {
      era: "現役",
      regions: ["国外"],
      relation_types: ["同郷"],
    },
    showAllRanks: false,
  },
  {
    id: "kyushu",
    emoji: "🌋",
    label: "九州の荒波",
    description: "関取輩出数トップの熊本・鹿児島を擁する九州・沖縄勢の絆",
    filter: {
      era: "現役",
      regions: ["九州・沖縄"],
      relation_types: ["同郷"],
    },
    showAllRanks: false,
  },
  {
    id: "kinki",
    emoji: "🏯",
    label: "近畿の猛者",
    description: "大阪・兵庫を中心に、近畿出身力士たちの同郷ネットワーク",
    filter: {
      era: "現役",
      regions: ["近畿"],
      relation_types: ["同郷"],
    },
    showAllRanks: false,
  },
  {
    id: "tohoku",
    emoji: "❄️",
    label: "東北・北海道の誇り",
    description: "北の大地・青森から生まれた力士たちの同郷つながり",
    filter: {
      era: "現役",
      regions: ["北海道・東北"],
      relation_types: ["同郷"],
    },
    showAllRanks: false,
  },
  // ─── 学校系 ────────────────────────────────────────────────────────────────
  {
    id: "university",
    emoji: "🎓",
    label: "大学相撲の絆",
    description: "日大・日体大・中央大……同じ大学で鍛えた仲間たちのネットワーク",
    filter: {
      era: "現役",
      educations: ["大卒"],
      relation_types: ["土俵の青春（同大学）"],
    },
    showAllRanks: false,
  },
  {
    id: "highschool",
    emoji: "🏟",
    label: "高校相撲の精鋭",
    description: "埼玉栄・飛龍・明徳義塾……相撲名門高校出身者の同窓ネットワーク",
    filter: {
      era: "現役",
      educations: ["高卒"],
      relation_types: ["土俵の青春（同高校）"],
    },
    showAllRanks: false,
  },
  // ─── 一門系（新規） ────────────────────────────────────────────────────────
  {
    id: "nishonoseki",
    emoji: "👑",
    label: "二所ノ関一門の覇道",
    description: "大の里・安青錦・豊昇龍を擁する17部屋・最大派閥の人脈図",
    filter: {
      era: "現役",
      ichimons: ["二所ノ関一門"],
      rankDivisions: ["幕内", "十両"],
      relation_types: ["一門の絆", "兄弟弟子", "師弟（師匠）"],
    },
    showAllRanks: false,
  },
  // ─── キャリア系 ────────────────────────────────────────────────────────────
  {
    id: "rising_stars",
    emoji: "🔥",
    label: "今ノッてる力士たち",
    description: "直近5場所で番付を上げ続けている勢いのある44名",
    filter: {
      era: "現役",
      careerTrends: ["rising"],
      rankDivisions: ["幕内", "十両"],
    },
    showAllRanks: false,
  },
  {
    id: "declining",
    emoji: "📉",
    label: "崖っぷちの男たち",
    description: "番付を下げ続ける39名。このまま終わるか、反撃があるか",
    filter: {
      era: "現役",
      careerTrends: ["declining"],
      rankDivisions: ["幕内", "十両"],
    },
    showAllRanks: false,
  },
  {
    id: "veterans",
    emoji: "🦅",
    label: "百戦錬磨の猛者",
    description: "玉鷲94場所・高安91場所……30場所以上関取を務める鉄人たちの絆",
    filter: {
      era: "現役",
      careerStages: ["veteran"],
      rankDivisions: ["幕内", "十両"],
    },
    showAllRanks: false,
  },
  {
    id: "fast_promotion",
    emoji: "⚡",
    label: "電光石火の出世頭",
    description: "大の里2場所・御嶽海2場所……初土俵から10場所以内に関取昇進した逸材",
    filter: {
      era: "現役",
      promotionSpeeds: ["fast"],
      rankDivisions: ["幕内", "十両"],
    },
    showAllRanks: false,
  },
  {
    id: "late_bloomers",
    emoji: "🌺",
    label: "遅咲きの大輪",
    description: "霧島22場所・琴桜22場所・欧勝海23場所……雌伏を経て咲き誇る男たち",
    filter: {
      era: "現役",
      promotionSpeeds: ["late"],
      rankDivisions: ["幕内", "十両"],
    },
    showAllRanks: false,
  },
];

/**
 * ランダムにテーマを選ぶ（excludeId と同じものは除外）
 */
export function pickRandomTheme(excludeId?: string): CuratedTheme {
  const pool = excludeId
    ? CURATED_THEMES.filter((t) => t.id !== excludeId)
    : CURATED_THEMES;
  return pool[Math.floor(Math.random() * pool.length)];
}

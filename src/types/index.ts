// ─── 引退・親方関連の型 ───────────────────────────────────────────────────────
export type RikishiStatus = "active" | "retired";
export type HeyaRole = "shisho" | "tsuke_oyakata";
export type OyakataHistoryReason =
  | "就任"
  | "名跡移転"
  | "定年返上"
  | "退職"
  | "死亡"
  | "継承"
  | "その他";

export interface OyakataMaster {
  id: string;
  name: string;
  yomigana: string | null;
  ichimon: string | null;
  is_ichidai_toshiyori: boolean;
  notes: string | null;
  created_at: string;
}

export interface OyakataNameHistory {
  id: string;
  rikishi_id: string;
  oyakata_master_id: string;
  oyakata_master: Pick<OyakataMaster, "name" | "yomigana" | "ichimon"> | null;
  start_date: string;      // DATE as ISO string (YYYY-MM-DD)
  end_date: string | null; // NULL = 現在保有中
  reason: OyakataHistoryReason | null;
  notes: string | null;
  created_at: string;
}

// ─── ランク型 ─────────────────────────────────────────────────────────────────
export type Rank =
  | "yokozuna"
  | "ozeki"
  | "sekiwake"
  | "komusubi"
  | "maegashira"
  | "juryo"
  | "makushita"
  | "sandanme"
  | "jonidan"
  | "jonokuchi"
  | "引退";

export type RelationType =
  | "師弟（師匠）"
  | "師弟（弟子）"
  | "親子・兄弟"
  | "兄弟弟子"
  | "同郷"
  | "土俵の青春（同高校）"
  | "土俵の青春（同大学）"
  | "同期の絆（入門）"
  | "親族"
  | "一門の絆";

export type EducationFilter = "中卒" | "高卒" | "大卒";
export type AgeGroupFilter =
  | "10代"
  | "20代前半"
  | "20代後半"
  | "30代前半"
  | "35歳以上";

// ─── キャリア分類 ─────────────────────────────────────────────────────────────
export type CareerTrend    = "rising" | "stable" | "declining" | "volatile";
export type CareerStage    = "veteran" | "mid" | "new";
export type PromotionSpeed = "fast" | "normal" | "late";

export const CAREER_TREND_LIST: readonly CareerTrend[] = [
  "rising", "stable", "declining", "volatile",
] as const;
export const CAREER_STAGE_LIST: readonly CareerStage[] = [
  "veteran", "mid", "new",
] as const;
export const PROMOTION_SPEED_LIST: readonly PromotionSpeed[] = [
  "fast", "normal", "late",
] as const;

export const CAREER_TREND_LABELS: Record<CareerTrend, string> = {
  rising:    "🔥 上昇中",
  stable:    "📊 安定",
  declining: "📉 下降中",
  volatile:  "🎢 上下動",
};
export const CAREER_STAGE_LABELS: Record<CareerStage, string> = {
  veteran: "🦅 ベテラン",
  mid:     "⚔️ 中堅",
  new:     "🌱 新鋭",
};
export const PROMOTION_SPEED_LABELS: Record<PromotionSpeed, string> = {
  fast:   "⚡ 急行（〜10場所）",
  normal: "🚂 普通（11〜20場所）",
  late:   "🐢 遅咲き（21場所〜）",
};

export type RankDivision = "幕内" | "十両" | "幕下" | "三段目" | "序二段" | "序の口";
export const RANK_DIVISION_LIST: readonly RankDivision[] = [
  "幕内", "十両", "幕下", "三段目", "序二段", "序の口",
] as const;
export const RANK_DIVISION_CLASSES: Record<RankDivision, string[]> = {
  "幕内":   ["yokozuna", "ozeki", "sekiwake", "komusubi", "maegashira"],
  "十両":   ["juryo"],
  "幕下":   ["makushita"],
  "三段目": ["sandanme"],
  "序二段": ["jonidan"],
  "序の口": ["jonokuchi"],
};

export const ICHIMON_LIST = [
  "出羽海一門",
  "二所ノ関一門",
  "時津風一門",
  "高砂一門",
  "伊勢ヶ濱一門",
] as const;
export type Ichimon = (typeof ICHIMON_LIST)[number];

export interface Heya {
  id: string;
  name: string;
  ichimon: string | null;
  created_year: number | null;
  closed_year: number | null;
}

export interface Rikishi {
  id: string;
  shikona: string;
  yomigana: string | null;
  real_name: string | null;
  heya_id: string | null;
  heya?: Heya;
  born_place: string | null;
  birth_date: string | null;       // DATE as ISO string (YYYY-MM-DD)
  highest_rank: Rank | null;
  active_from_basho:  string | null; // basho id 'YYYY-MM'
  high_school: string | null;
  university: string | null;
  episodes: string | null;
  photo_url: string | null;
  wiki_url: string | null;
  shisho_id: string | null;
  oyakata_id: string | null;
  retirement_basho: string | null; // basho id 'YYYY-MM'
  // migration_retirement_oyakata_history.sql で追加
  status: RikishiStatus;
  heya_role: HeyaRole | null;
  created_at: string;
}

export interface Relationship {
  id: string;
  rikishi_a_id: string;
  rikishi_b_id: string;
  rikishi_a?: Rikishi;
  rikishi_b?: Rikishi;
  relation_type: RelationType;
  description: string | null;
  created_at: string;
}

// --- グラフ用の型 ---
export interface GraphNode {
  id: string;
  name: string;
  /** 有効ランク: 現役=banzuke の rank_class、引退=highest_rank */
  rank: string | null;
  /** 番付表示文字列: 現役=banzuke の rank_display（例: "Y1e"）、引退=null */
  rank_display: string | null;
  heya: string | null;
  heya_id: string | null;
  ichimon: string | null;
  photo_url: string | null;
  born_place: string | null;
  birth_date: string | null;       // DATE as ISO string (YYYY-MM-DD)
  active_from_basho:  string | null; // basho id 'YYYY-MM'
  retirement_basho:   string | null; // basho id 'YYYY-MM'
  status:             string;         // 'active' | 'retired'
  high_school: string | null;
  university: string | null;
  career_trend:    CareerTrend | null;
  career_stage:    CareerStage | null;
  promotion_speed: PromotionSpeed | null;
  /** 拡張用タグ: "外国人", "学生相撲出身", "親方経験" など */
  tags?: string[];
  // D3 force layout が付加する値
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: RelationType;
  description: string | null;
  /** 関係の濃さ: 5=血縁, 4=師弟（師匠）, 3=師弟（弟子）/兄弟弟子, 2=同一門, 1=同郷・同学校 */
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// ─── 場所マスタ ───────────────────────────────────────────────────────────────
export interface Basho {
  id:         string;       // 'YYYY-MM'
  name:       string;       // '令和8年初場所'
  short_name: string;       // '初場所'
  location:   string;       // '東京' | '大阪' | '名古屋' | '福岡'
  start_date: string | null;
  end_date:   string | null;
}

// ─── 番付エントリ ─────────────────────────────────────────────────────────────
export interface BanzukeEntry {
  id:           string;
  rikishi_id:   string;
  basho:        string;       // 'YYYY-MM'
  rank_class:   string;       // 'yokozuna' | 'ozeki' | ...
  rank_number:  number | null;
  rank_side:    string | null; // 'east' | 'west'
  rank_display: string | null; // 'Y1e', 'M14w' など
}

// --- フィルター ---
export interface FilterState {
  heyas:          string[];          // 空配列 = すべての部屋
  ichimons:       string[];          // 空配列 = すべての一門（複数ON/OFF）
  relation_types: RelationType[];    // 空配列 = すべての関係種別
  era:            "現役" | "引退" | "全員";
  rankDivisions:  RankDivision[];    // 空配列 = すべての番付, 非空 = 指定番付のみ
  // ─ クライアントサイドフィルター ─
  educations:     EducationFilter[]; // 空配列 = すべての学歴
  regions:        string[];          // 空配列 = すべての出身地域
  ageGroups:      AgeGroupFilter[];  // 空配列 = すべての年齢層
  careerTrends:   CareerTrend[];     // 空配列 = すべてのキャリアトレンド
  careerStages:   CareerStage[];     // 空配列 = すべてのキャリアステージ
  promotionSpeeds: PromotionSpeed[]; // 空配列 = すべての昇進スピード
}

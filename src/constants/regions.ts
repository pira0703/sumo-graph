import type { AgeGroupFilter } from "@/types";

// ─── 出身地域 ──────────────────────────────────────────────────────────────────
export const REGION_LABELS = [
  "北海道・東北",
  "関東・甲信越",
  "中部",
  "近畿",
  "中国・四国",
  "九州・沖縄",
  "国外",
] as const;

export type RegionLabel = (typeof REGION_LABELS)[number];

/** 都道府県 → 地域 マッピング */
const PREF_TO_REGION: Record<string, RegionLabel> = {
  // 北海道・東北
  北海道: "北海道・東北",
  青森県: "北海道・東北",
  岩手県: "北海道・東北",
  宮城県: "北海道・東北",
  秋田県: "北海道・東北",
  山形県: "北海道・東北",
  福島県: "北海道・東北",
  // 関東・甲信越
  茨城県: "関東・甲信越",
  栃木県: "関東・甲信越",
  群馬県: "関東・甲信越",
  埼玉県: "関東・甲信越",
  千葉県: "関東・甲信越",
  東京都: "関東・甲信越",
  神奈川県: "関東・甲信越",
  新潟県: "関東・甲信越",
  山梨県: "関東・甲信越",
  長野県: "関東・甲信越",
  // 中部
  富山県: "中部",
  石川県: "中部",
  福井県: "中部",
  静岡県: "中部",
  愛知県: "中部",
  岐阜県: "中部",
  三重県: "中部",
  // 近畿
  滋賀県: "近畿",
  京都府: "近畿",
  京都: "近畿",    // DBに「府」なしで格納されているケース
  大阪府: "近畿",
  兵庫県: "近畿",
  奈良県: "近畿",
  和歌山県: "近畿",
  // 中国・四国
  鳥取県: "中国・四国",
  島根県: "中国・四国",
  岡山県: "中国・四国",
  広島県: "中国・四国",
  山口県: "中国・四国",
  徳島県: "中国・四国",
  香川県: "中国・四国",
  愛媛県: "中国・四国",
  高知県: "中国・四国",
  // 九州・沖縄
  福岡県: "九州・沖縄",
  佐賀県: "九州・沖縄",
  長崎県: "九州・沖縄",
  熊本県: "九州・沖縄",
  大分県: "九州・沖縄",
  宮崎県: "九州・沖縄",
  鹿児島県: "九州・沖縄",
  沖縄県: "九州・沖縄",
};

/**
 * born_place（都道府県 or 国名）を地域ラベルに変換
 * 日本の都道府県以外はすべて「国外」
 */
export function getRegion(bornPlace: string | null): RegionLabel | null {
  if (!bornPlace) return null;
  return PREF_TO_REGION[bornPlace] ?? "国外";
}

// ─── 年齢グループ ──────────────────────────────────────────────────────────────
export const AGE_GROUP_LABELS: AgeGroupFilter[] = [
  "10代",
  "20代前半",
  "20代後半",
  "30代前半",
  "35歳以上",
];

/**
 * birth_date（YYYY-MM-DD）から年齢グループを返す
 * birth_date が null の場合は null を返す
 */
export function getAgeGroup(
  birthDate: string | null,
  today: Date = new Date()
): AgeGroupFilter | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

  if (age < 20) return "10代";
  if (age < 25) return "20代前半";
  if (age < 30) return "20代後半";
  if (age < 35) return "30代前半";
  return "35歳以上";
}

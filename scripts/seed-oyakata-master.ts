/**
 * seed-oyakata-master.ts
 * 親方株（年寄名跡）マスタデータ登録
 *
 * 実行方法:
 *   op run --env-file=.env.local -- npx tsx scripts/seed-oyakata-master.ts
 *
 * ── 仕様メモ ─────────────────────────────────────────────────────────────────
 * ● 105名跡: 日本相撲協会が管理する年寄名跡。譲渡・継承可能。
 * ● 一代年寄 (is_ichidai_toshiyori=true):
 *     横綱引退時に特別功績により認定。現役四股名をそのまま使用。一代限り・譲渡不可。
 *     過去認定: 大鵬、北の湖、貴乃花 ／ 辞退: 千代の富士（九重を選択）、白鵬（間垣を選択）
 * ● 現役名年寄（横綱5年・大関3年の猶予）は本テーブルとは別管理。
 * ● 照ノ富士は「伊勢ヶ濱」を正式襲名済み（現役名年寄でも一代年寄でもない）
 *
 * ── 一門構成（2026年3月確認・スクリーンショット正式ソース）────────────────
 * 出羽海一門: 出羽海・境川・武隈・藤島・武蔵川・二子山・春日野・玉ノ井・雷・
 *             山響・木瀬・尾上・式秀・立浪（＋旧来名跡）
 * 二所ノ関一門: 二所ノ関・中村・佐渡ヶ嶽・押尾川・鳴戸・秀ノ山・片男波・
 *               田子ノ浦・西岩・放駒・芝田山・高田川・阿武松・大嶽・湊川・湊・錣山（＋旧来名跡）
 * 時津風一門: 時津風・荒汐・伊勢ノ海・音羽山・追手風（＋旧来名跡）
 * 高砂一門: 高砂・錦戸・九重・八角（＋旧来名跡）
 * 伊勢ヶ濱一門: 伊勢ヶ濱・安治川・大島・浅香山・朝日山
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface OyakataMasterSeed {
  name: string;
  yomigana: string;
  ichimon: string | null;
  is_ichidai_toshiyori?: boolean;
  notes?: string;
}

// ─── 105名跡 + 一代年寄 ──────────────────────────────────────────────────────
// ichimon は現時点（2026年3月）での所属一門
// ソース: 日本相撲協会 年寄名跡一覧・相撲部屋一覧（ユーザー提供スクリーンショット 2026年3月確認）
const OYAKATA_LIST: OyakataMasterSeed[] = [

  // ════════════════════════════════════════════════
  // 出羽海一門
  // 現役部屋: 出羽海・境川・武隈・藤島・武蔵川・二子山・春日野・玉ノ井・雷・山響・木瀬・尾上・式秀・立浪
  // ════════════════════════════════════════════════
  { name: "出羽海",     yomigana: "でわのうみ",     ichimon: "出羽海一門" },
  { name: "境川",       yomigana: "さかいがわ",     ichimon: "出羽海一門" },
  { name: "武隈",       yomigana: "たけくま",       ichimon: "出羽海一門" },
  { name: "藤島",       yomigana: "ふじしま",       ichimon: "出羽海一門", notes: "旧・武蔵川部屋が2010年に藤島部屋へ改称。元大関・武双山が師匠" },
  { name: "武蔵川",     yomigana: "むさしがわ",     ichimon: "出羽海一門" },
  { name: "二子山",     yomigana: "ふたごやま",     ichimon: "出羽海一門" },
  { name: "春日野",     yomigana: "かすがの",       ichimon: "出羽海一門" },
  { name: "玉ノ井",     yomigana: "たまのい",       ichimon: "出羽海一門" },
  { name: "雷",         yomigana: "いかずち",       ichimon: "出羽海一門" },
  { name: "山響",       yomigana: "やまひびき",     ichimon: "出羽海一門" },
  { name: "木瀬",       yomigana: "きせ",           ichimon: "出羽海一門" },
  { name: "尾上",       yomigana: "おのえ",         ichimon: "出羽海一門" },
  { name: "式秀",       yomigana: "しきひで",       ichimon: "出羽海一門" },
  { name: "立浪",       yomigana: "たてなみ",       ichimon: "出羽海一門", notes: "旧・立浪一門の宗家。立浪一門解散後に出羽海一門へ" },
  // 旧来名跡（一門帰属は出羽海一門）
  { name: "三保ヶ関",   yomigana: "みほがせき",     ichimon: "出羽海一門" },
  { name: "常盤山",     yomigana: "ときわやま",     ichimon: "出羽海一門", notes: "旧・常盤山名跡。2026年1月貴景勝継承分は「湊川」として改称" },
  { name: "入間川",     yomigana: "いるまがわ",     ichimon: "出羽海一門" },
  { name: "北陣",       yomigana: "きたじん",       ichimon: "出羽海一門" },
  { name: "甲山",       yomigana: "かぶとやま",     ichimon: "出羽海一門" },
  { name: "宮城野",     yomigana: "みやぎの",       ichimon: "出羽海一門", notes: "宮城野部屋は2023年解散。名跡は存続" },
  { name: "佐ノ山",     yomigana: "さのやま",       ichimon: "出羽海一門" },
  { name: "桐山",       yomigana: "きりやま",       ichimon: "出羽海一門" },

  // ════════════════════════════════════════════════
  // 二所ノ関一門
  // 現役部屋: 二所ノ関・中村・佐渡ヶ嶽・押尾川・鳴戸・秀ノ山・片男波・田子ノ浦・
  //           西岩・放駒・芝田山・高田川・阿武松・大嶽・湊川・湊・錣山
  // ════════════════════════════════════════════════
  { name: "二所ノ関",   yomigana: "にしょのせき",   ichimon: "二所ノ関一門" },
  { name: "中村",       yomigana: "なかむら",       ichimon: "二所ノ関一門" },
  { name: "佐渡ヶ嶽",   yomigana: "さどがたけ",     ichimon: "二所ノ関一門" },
  { name: "押尾川",     yomigana: "おしおかわ",     ichimon: "二所ノ関一門" },
  { name: "鳴戸",       yomigana: "なると",         ichimon: "二所ノ関一門" },
  { name: "秀ノ山",     yomigana: "ひでのやま",     ichimon: "二所ノ関一門" },
  { name: "片男波",     yomigana: "かたおなみ",     ichimon: "二所ノ関一門" },
  { name: "田子ノ浦",   yomigana: "たごのうら",     ichimon: "二所ノ関一門" },
  { name: "西岩",       yomigana: "にしのいわ",     ichimon: "二所ノ関一門" },
  { name: "放駒",       yomigana: "はなれごま",     ichimon: "二所ノ関一門" },
  { name: "芝田山",     yomigana: "しばたやま",     ichimon: "二所ノ関一門" },
  { name: "高田川",     yomigana: "たかだがわ",     ichimon: "二所ノ関一門" },
  { name: "阿武松",     yomigana: "おうのうまつ",   ichimon: "二所ノ関一門" },
  { name: "大嶽",       yomigana: "おおたけ",       ichimon: "二所ノ関一門" },
  { name: "湊川",       yomigana: "みなとがわ",     ichimon: "二所ノ関一門", notes: "2026年1月26日付で常盤山から改称。元大関・貴景勝が師匠継承" },
  { name: "湊",         yomigana: "みなと",         ichimon: "二所ノ関一門" },
  { name: "錣山",       yomigana: "しころやま",     ichimon: "二所ノ関一門" },
  // 旧来名跡（一門帰属は二所ノ関一門）
  { name: "荒磯",       yomigana: "あらいそ",       ichimon: "二所ノ関一門" },
  { name: "大鳴戸",     yomigana: "おおなると",     ichimon: "二所ノ関一門" },
  { name: "楯山",       yomigana: "たてやま",       ichimon: "二所ノ関一門" },
  { name: "清見潟",     yomigana: "きよみがた",     ichimon: "二所ノ関一門" },
  { name: "峰崎",       yomigana: "みねざき",       ichimon: "二所ノ関一門" },
  { name: "花籠",       yomigana: "はなごさ",       ichimon: "二所ノ関一門" },
  { name: "間垣",       yomigana: "まがき",         ichimon: "二所ノ関一門", notes: "元横綱・白鵬が一代年寄を辞退し2023年継承" },
  { name: "錦島",       yomigana: "にしきじま",     ichimon: "二所ノ関一門", notes: "旧・貴乃花名跡。貴乃花退職後に改名" },
  { name: "玉垣",       yomigana: "たまがき",       ichimon: "二所ノ関一門" },
  { name: "松ヶ根",     yomigana: "まつがね",       ichimon: "二所ノ関一門" },

  // ════════════════════════════════════════════════
  // 時津風一門
  // 現役部屋: 時津風・荒汐・伊勢ノ海・音羽山・追手風
  // ════════════════════════════════════════════════
  { name: "時津風",     yomigana: "ときつかぜ",     ichimon: "時津風一門" },
  { name: "荒汐",       yomigana: "あらしお",       ichimon: "時津風一門", notes: "旧・立浪一門。立浪一門解散後に時津風一門へ" },
  { name: "伊勢ノ海",   yomigana: "いせのうみ",     ichimon: "時津風一門" },
  { name: "音羽山",     yomigana: "おとわやま",     ichimon: "時津風一門" },
  { name: "追手風",     yomigana: "おいてかぜ",     ichimon: "時津風一門", notes: "旧・立浪一門。立浪一門解散後に時津風一門へ" },
  // 旧来名跡（一門帰属は時津風一門）
  { name: "陸奥",       yomigana: "むつ",           ichimon: "時津風一門" },
  { name: "井筒",       yomigana: "いづつ",         ichimon: "時津風一門", notes: "2017年師匠逝去により閉部屋。名跡は存続" },
  { name: "中立",       yomigana: "なかだち",       ichimon: "時津風一門" },
  { name: "浦風",       yomigana: "うらかぜ",       ichimon: "時津風一門" },
  { name: "岩友",       yomigana: "いわとも",       ichimon: "時津風一門" },
  { name: "立田川",     yomigana: "たつたがわ",     ichimon: "時津風一門" },
  { name: "尾車",       yomigana: "おぐるま",       ichimon: "時津風一門" },

  // ════════════════════════════════════════════════
  // 高砂一門
  // 現役部屋: 高砂・錦戸・九重・八角
  // ════════════════════════════════════════════════
  { name: "高砂",       yomigana: "たかさご",       ichimon: "高砂一門" },
  { name: "錦戸",       yomigana: "にしきど",       ichimon: "高砂一門", notes: "旧・立浪一門。立浪一門解散後に高砂一門へ" },
  { name: "九重",       yomigana: "ここのえ",       ichimon: "高砂一門", notes: "元横綱・千代の富士が一代年寄を辞退し継承" },
  { name: "八角",       yomigana: "はっかく",       ichimon: "高砂一門", notes: "元横綱・北勝海が継承。現 日本相撲協会理事長" },
  // 旧来名跡（一門帰属は高砂一門）
  { name: "振分",       yomigana: "ふりわけ",       ichimon: "高砂一門" },
  { name: "富士ヶ根",   yomigana: "ふじがね",       ichimon: "高砂一門" },
  { name: "浜風",       yomigana: "はまかぜ",       ichimon: "高砂一門" },
  { name: "鏡山",       yomigana: "かがみやま",     ichimon: "高砂一門" },
  { name: "若松",       yomigana: "わかまつ",       ichimon: "高砂一門" },
  { name: "待乳山",     yomigana: "まつちやま",     ichimon: "高砂一門" },
  { name: "千賀ノ浦",   yomigana: "ちがのうら",     ichimon: "高砂一門" },
  { name: "東関",       yomigana: "ひがしのせき",   ichimon: "高砂一門" },

  // ════════════════════════════════════════════════
  // 伊勢ヶ濱一門
  // 現役部屋: 伊勢ヶ濱・安治川・大島・浅香山・朝日山
  // ════════════════════════════════════════════════
  { name: "伊勢ヶ濱",   yomigana: "いせがはま",     ichimon: "伊勢ヶ濱一門", notes: "照ノ富士が2025年引退後に正式継承。宮城野部屋吸収後に一門独立" },
  { name: "安治川",     yomigana: "あじがわ",       ichimon: "伊勢ヶ濱一門" },
  { name: "大島",       yomigana: "おおしま",       ichimon: "伊勢ヶ濱一門" },
  { name: "浅香山",     yomigana: "あさかやま",     ichimon: "伊勢ヶ濱一門" },
  { name: "朝日山",     yomigana: "あさひやま",     ichimon: "伊勢ヶ濱一門" },

  // ════════════════════════════════════════════════
  // 一門帰属不明・要確認（旧立浪一門解散後の行方不明分含む）
  // ════════════════════════════════════════════════
  // 旧・立浪一門（帰属未確定）
  { name: "春日山",     yomigana: "かすがやま",     ichimon: null, notes: "旧・立浪一門。現在の一門帰属未確認" },
  { name: "中川",       yomigana: "なかがわ",       ichimon: null, notes: "旧・立浪一門。現在の一門帰属未確認" },
  { name: "高島",       yomigana: "たかしま",       ichimon: null, notes: "旧・立浪一門。現在の一門帰属未確認" },
  { name: "若藤",       yomigana: "わかふじ",       ichimon: null, notes: "旧・立浪一門。現在の一門帰属未確認" },
  { name: "友綱",       yomigana: "ともつな",       ichimon: null, notes: "旧・立浪一門。現在の一門帰属未確認" },
  { name: "山科",       yomigana: "やましな",       ichimon: null, notes: "旧・立浪一門。現在の一門帰属未確認" },
  // その他要確認
  { name: "二十山",     yomigana: "はたちやま",     ichimon: null },
  { name: "高崎",       yomigana: "たかさき",       ichimon: null },
  { name: "稲川",       yomigana: "いながわ",       ichimon: null },
  { name: "大山",       yomigana: "おおやま",       ichimon: null },
  { name: "枝川",       yomigana: "えだがわ",       ichimon: null },
  { name: "小野川",     yomigana: "おのがわ",       ichimon: null },
  { name: "勝ノ浦",     yomigana: "かつのうら",     ichimon: null },
  { name: "君ヶ濱",     yomigana: "きみがはま",     ichimon: null },
  { name: "熊ヶ谷",     yomigana: "くまがたに",     ichimon: null },
  { name: "粂川",       yomigana: "くめがわ",       ichimon: null },
  { name: "白玉",       yomigana: "しらたま",       ichimon: null },
  { name: "不知火",     yomigana: "しらぬい",       ichimon: null },
  { name: "陣幕",       yomigana: "じんまく",       ichimon: null },
  { name: "関ノ戸",     yomigana: "せきのと",       ichimon: null },
  { name: "千田川",     yomigana: "ちだがわ",       ichimon: null },
  { name: "竹縄",       yomigana: "たけなわ",       ichimon: null },
  { name: "立田山",     yomigana: "たったやま",     ichimon: null },
  { name: "立川",       yomigana: "たちかわ",       ichimon: null },
  { name: "谷川",       yomigana: "たにがわ",       ichimon: null },
  { name: "出来山",     yomigana: "できやま",       ichimon: null },
  { name: "山分",       yomigana: "やまわけ",       ichimon: null },

  // ════════════════════════════════════════════════
  // 一代年寄（105名跡とは別枠・3名）
  // ════════════════════════════════════════════════
  {
    name: "大鵬",
    yomigana: "たいほう",
    ichimon: null,
    is_ichidai_toshiyori: true,
    notes: "第48代横綱・大鵬幸喜。1971年引退後に一代年寄認定。2013年逝去後に名跡消滅",
  },
  {
    name: "北の湖",
    yomigana: "きたのうみ",
    ichimon: null,
    is_ichidai_toshiyori: true,
    notes: "第55代横綱・北の湖敏満。1985年引退後に一代年寄認定。2015年逝去後に名跡消滅",
  },
  {
    name: "貴乃花",
    yomigana: "たかのはな",
    ichimon: null,
    is_ichidai_toshiyori: true,
    notes: "第65代横綱・貴乃花光司。2003年引退後に一代年寄認定。2018年退職後は名跡が「錦島」として継続",
  },
];

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🏛️  親方株マスタ登録開始...\n");

  // Step 1: 既存データ取得
  const { data: existingRows, error: fetchErr } = await supabase
    .from("oyakata_master")
    .select("id, name");
  if (fetchErr) throw fetchErr;

  const existingMap = new Map(
    (existingRows ?? []).map((r: { id: string; name: string }) => [r.name, r.id])
  );
  console.log(`📋 既存レコード: ${existingMap.size}件`);

  // Step 2: INSERT / UPDATE 振り分け
  type NormalizedRow = {
    name: string;
    yomigana: string;
    ichimon: string | null;
    is_ichidai_toshiyori: boolean;
    notes: string | null;
  };
  const toInsert: NormalizedRow[] = [];
  const toUpdate: (NormalizedRow & { id: string })[] = [];

  for (const row of OYAKATA_LIST) {
    const norm: NormalizedRow = {
      name: row.name,
      yomigana: row.yomigana,
      ichimon: row.ichimon ?? null,
      is_ichidai_toshiyori: row.is_ichidai_toshiyori ?? false,
      notes: row.notes ?? null,
    };
    const existingId = existingMap.get(row.name);
    if (existingId) {
      toUpdate.push({ ...norm, id: existingId });
    } else {
      toInsert.push(norm);
    }
  }

  // Step 3: INSERT（新規）
  let insertedCount = 0;
  if (toInsert.length > 0) {
    const { data: inserted, error: insertErr } = await supabase
      .from("oyakata_master")
      .insert(toInsert)
      .select("id, name");
    if (insertErr) throw insertErr;
    insertedCount = inserted?.length ?? 0;
  }

  // Step 4: UPDATE（既存・UUID保持）
  let updatedCount = 0;
  for (const row of toUpdate) {
    const { id, ...fields } = row;
    const { error } = await supabase
      .from("oyakata_master")
      .update(fields)
      .eq("id", id);
    if (error) throw error;
    updatedCount++;
  }

  console.log(`✅ INSERT: ${insertedCount}件`);
  console.log(`🔄 UPDATE: ${updatedCount}件`);

  // Step 5: 一代年寄サマリ
  const ichidaiRows = OYAKATA_LIST.filter((r) => r.is_ichidai_toshiyori);
  console.log(`\n🔑 一代年寄 (${ichidaiRows.length}件):`);
  for (const r of ichidaiRows) {
    console.log(`  - ${r.name}（${r.yomigana}）`);
  }

  // Step 6: 一門別サマリ
  const ichimonCounts: Record<string, number> = {};
  for (const r of OYAKATA_LIST) {
    if (r.is_ichidai_toshiyori) continue;
    const key = r.ichimon ?? "未確認";
    ichimonCounts[key] = (ichimonCounts[key] ?? 0) + 1;
  }
  console.log("\n📊 一門別名跡数（一代年寄除く）:");
  for (const [ichimon, count] of Object.entries(ichimonCounts).sort()) {
    console.log(`   ${ichimon.padEnd(12)}: ${count}件`);
  }

  // Step 7: 合計確認
  const { count } = await supabase
    .from("oyakata_master")
    .select("*", { count: "exact", head: true });
  console.log(`\n📊 oyakata_master 合計: ${count}件`);
  const standardCount = (count ?? 0) - ichidaiRows.length;
  console.log(`   うち標準名跡: ${standardCount}件 / 目標: 105件`);
  if (standardCount < 105) {
    console.log(`   ⚠️  あと${105 - standardCount}件の名跡が未登録です`);
  } else {
    console.log(`   ✅ 105名跡 登録完了`);
  }

  console.log("\n✨ 完了!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

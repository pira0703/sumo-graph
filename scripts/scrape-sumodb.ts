/**
 * sumodb.sumogames.de スクレイパー
 * 歴代幕内力士データを取得し、Supabaseに投入する
 *
 * 実行:
 *   op run --env-file=.env.local -- npx tsx scripts/scrape-sumodb.ts
 *
 * オプション:
 *   --dry-run      DBに書き込まず、取得件数だけ確認する
 *   --rank 1       横綱だけ取得 (1=横綱/2=大関/3=関脇/4=小結/5=前頭)
 *   --debug-html   最初の番付のHTMLを500文字ダンプして終了
 */

import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";

// ─── 設定 ───────────────────────────────────────────────────────────────────

const BASE = "https://sumodb.sumogames.de";
const DELAY_MS = 600; // サーバー負荷軽減のため各リクエスト間600ms待機
const BATCH_SIZE = 200; // Supabaseへの一括投入サイズ

const args = process.argv.slice(2);
const DRY_RUN    = args.includes("--dry-run");
const DEBUG_HTML = args.includes("--debug-html");
const RANK_FILTER = args.includes("--rank") ? args[args.indexOf("--rank") + 1] : null;

// 番付パラメータ (high=数字 が正しい値)
const RANK_PARAMS = [
  { param: "1", rank: "yokozuna",   label: "横綱" },
  { param: "2", rank: "ozeki",      label: "大関" },
  { param: "3", rank: "sekiwake",   label: "関脇" },
  { param: "4", rank: "komusubi",   label: "小結" },
  { param: "5", rank: "maegashira", label: "前頭" },
].filter(r => !RANK_FILTER || r.param === RANK_FILTER);

// ─── 出身地・国籍マップ ────────────────────────────────────────────────────

// sumodb英語出身地 → 日本語
const PLACE_MAP: Record<string, string> = {
  // 日本 (現代都道府県)
  "Aichi": "愛知県", "Akita": "秋田県", "Aomori": "青森県",
  "Chiba": "千葉県", "Ehime": "愛媛県", "Fukui": "福井県",
  "Fukuoka": "福岡県", "Fukushima": "福島県", "Gifu": "岐阜県",
  "Gunma": "群馬県", "Hiroshima": "広島県", "Hokkaido": "北海道",
  "Hyogo": "兵庫県", "Ibaraki": "茨城県", "Ishikawa": "石川県",
  "Iwate": "岩手県", "Kagawa": "香川県", "Kagoshima": "鹿児島県",
  "Kanagawa": "神奈川県", "Kochi": "高知県", "Kumamoto": "熊本県",
  "Kyoto": "京都府", "Mie": "三重県", "Miyagi": "宮城県",
  "Miyazaki": "宮崎県", "Nagano": "長野県", "Nagasaki": "長崎県",
  "Nara": "奈良県", "Niigata": "新潟県", "Oita": "大分県",
  "Okayama": "岡山県", "Okinawa": "沖縄県", "Osaka": "大阪府",
  "Saga": "佐賀県", "Saitama": "埼玉県", "Shiga": "滋賀県",
  "Shimane": "島根県", "Shizuoka": "静岡県", "Tochigi": "栃木県",
  "Tokushima": "徳島県", "Tokyo": "東京都", "Tottori": "鳥取県",
  "Toyama": "富山県", "Wakayama": "和歌山県", "Yamagata": "山形県",
  "Yamaguchi": "山口県", "Yamanashi": "山梨県",
  // 旧国名
  "Awa": "阿波", "Chikuzen": "筑前", "Dewa": "出羽", "Echigo": "越後",
  "Edo": "江戸", "Esshu": "越州", "Etchu": "越中", "Harima": "播磨",
  "Hizen": "肥前", "Hoki": "伯耆", "Iburi": "胆振", "Izu": "伊豆",
  "Kaga": "加賀", "Kawachi": "河内", "Kyushu": "九州", "Musashi": "武蔵",
  "Mutsu": "陸奥", "Nanbu": "南部", "Odawara": "小田原",
  "Osaka (old)": "大坂", "Oshu": "奥州", "Owari": "尾張",
  "Rikuchu": "陸中", "Sachalin": "樺太", "Sagami": "相模",
  "Sattsu": "讃岐(旧)", "Sendai": "仙台", "Sesshu": "摂津",
  "Shimousa": "下総", "Shinano": "信濃", "Shiribe": "後志",
  "Tosa": "土佐", "Ugo": "羽後",
  // 外国
  "Mongolia": "モンゴル", "U.S.A.": "アメリカ", "USA": "アメリカ",
  "Hawaii": "ハワイ", "Brazil": "ブラジル", "Bulgaria": "ブルガリア",
  "Georgia": "ジョージア", "Georgia (old)": "ジョージア(旧)",
  "Russia": "ロシア", "China": "中国", "Korea": "韓国",
  "Romania": "ルーマニア", "Tonga": "トンガ", "Czech": "チェコ",
  "Philippines": "フィリピン", "Estonia": "エストニア",
  "Kazakhstan": "カザフスタン", "Ukraine": "ウクライナ",
  "Argentina": "アルゼンチン", "Hungary": "ハンガリー",
  "Paraguay": "パラグアイ", "Sri Lanka": "スリランカ",
  "Taiwan": "台湾", "Hong Kong": "香港", "Western Samoa": "西サモア",
  "Canada": "カナダ", "Great Britain": "イギリス",
  "Egypt": "エジプト", "Indonesia": "インドネシア",
};

// 外国出身地 → 国籍
const FOREIGN_NATIONALITIES: Record<string, string> = {
  "Mongolia": "モンゴル", "U.S.A.": "アメリカ", "USA": "アメリカ",
  "Hawaii": "アメリカ", "Brazil": "ブラジル", "Bulgaria": "ブルガリア",
  "Georgia": "ジョージア", "Georgia (old)": "ジョージア",
  "Russia": "ロシア", "China": "中国", "Korea": "韓国",
  "Romania": "ルーマニア", "Tonga": "トンガ", "Czech": "チェコ",
  "Philippines": "フィリピン", "Estonia": "エストニア",
  "Kazakhstan": "カザフスタン", "Ukraine": "ウクライナ",
  "Argentina": "アルゼンチン", "Hungary": "ハンガリー",
  "Paraguay": "パラグアイ", "Sri Lanka": "スリランカ",
  "Taiwan": "台湾", "Hong Kong": "中国", "Western Samoa": "サモア",
  "Canada": "カナダ", "Great Britain": "イギリス",
  "Egypt": "エジプト", "Indonesia": "インドネシア",
};

// ─── 型定義 ────────────────────────────────────────────────────────────────

interface ScrapedRikishi {
  sumodbId: number;
  shikona: string;
  heyaName: string;
  bornPlace: string | null;
  bornYear: number | null;
  highestRank: string;
  activeFrom: number | null;
  activeTo: number | null;
  nationality: string;
}

// ─── ユーティリティ ────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "SumoGraphBot/1.0 (personal research)",
      "Accept": "text/html,application/xhtml+xml;charset=UTF-8",
      "Accept-Language": "ja,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

function normalizePlace(raw: string): string | null {
  if (!raw || raw === "-") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // 日本語が含まれていればそのまま返す
  if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(trimmed)) return trimmed;
  return PLACE_MAP[trimmed] ?? trimmed;
}

function inferNationality(shusshinRaw: string): string {
  const trimmed = shusshinRaw.trim();
  return FOREIGN_NATIONALITIES[trimmed] ?? "日本";
}

function normalizeHeyaName(raw: string): string {
  if (!raw || raw === "-") return "不明";
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-") return "不明";
  // 日本語が含まれていれば「部屋」を付ける
  if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(trimmed)) {
    return trimmed.endsWith("部屋") ? trimmed : trimmed + "部屋";
  }
  // 英語 (ローマ字) の場合: "Kitanoumi" → "北の湖部屋" ではなくそのまま
  return trimmed;
}

/**
 * 誕生年を抽出 (形式: "May 8, 1969" / "1932" / "1600")
 */
function parseBirthYear(raw: string): number | null {
  if (!raw || raw === "-") return null;
  const m = raw.trim().match(/(\d{4})/);
  return m ? parseInt(m[1]) : null;
}

/**
 * 場所コードから年を抽出 (形式: "1988.03" / "0.00")
 */
function parseBashoYear(raw: string): number | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed === "-" || trimmed === "0.00" || trimmed === "0") return null;
  const m = trimmed.match(/^(\d{4})/);
  return m ? parseInt(m[1]) : null;
}

// ─── HTMLパーサー ─────────────────────────────────────────────────────────

/**
 * sumodb のrikishiリストページをスクレイプ
 *
 * 実際の列順 (2024年時点):
 * 0:Shikona  1:Heya  2:Shusshin  3:Birth Date  4:Highest Rank
 * 5:Hatsu Dohyo  6:Intai  7:Last Shikona
 *
 * URL: /Rikishi.aspx?shikona=&heya=-1&shusshin=-1&b=-1&high=1&hd=-1&active=0&sort=1
 */
async function scrapeRikishiList(
  rankParam: string,
  rankValue: string,
  label: string
): Promise<ScrapedRikishi[]> {
  const url = `${BASE}/Rikishi.aspx?shikona=&heya=-1&shusshin=-1&b=-1&high=${rankParam}&hd=-1&active=0&sort=1`;
  const html = await fetchHtml(url);

  if (DEBUG_HTML) {
    console.log("\n--- DEBUG HTML (先頭1000文字) ---");
    console.log(html.slice(0, 1000));
    console.log("--- END ---\n");
    process.exit(0);
  }

  const $ = cheerio.load(html);
  const results: ScrapedRikishi[] = [];

  // ─ テーブルを探す ─────────────────────────────────────────────
  // sumodbは <table border="0"> でクラスなし
  let table = $("table[border='0']").first();
  if (!table.length) {
    // フォールバック: 力士リンクを含む最初のテーブル
    table = $("table").filter((_, el) => {
      return $(el).find("td a[href*='Rikishi.aspx?r=']").length > 0;
    }).first();
  }

  if (!table.length) {
    console.warn(`\n   ⚠️  ${label}: テーブルが見つかりませんでした`);
    console.warn(`      page title: ${$("title").text()}`);
    console.warn(`      HTML先頭: ${html.slice(0, 400)}`);
    return results;
  }

  // ─ ヘッダー行からカラム位置を特定 ──────────────────────────────
  const headerRow = table.find("thead tr, tr").first();
  const headers = headerRow.find("th, td")
    .map((_, el) => $(el).text().trim().toLowerCase())
    .get();

  // カラムインデックス
  const col = {
    shikona:  findCol(headers, ["shikona", "name"], 0),
    heya:     findCol(headers, ["heya", "stable"], 1),
    shusshin: findCol(headers, ["shusshin", "birthplace", "birth place", "from"], 2),
    born:     findCol(headers, ["birth date", "born", "birth"], 3),
    high:     findCol(headers, ["highest rank", "high", "rank"], 4),
    debut:    findCol(headers, ["hatsu dohyo", "debut", "first"], 5),
    intai:    findCol(headers, ["intai", "retire", "last"], 6),
  };

  // ─ データ行をパース ───────────────────────────────────────────
  table.find("tbody tr, tr").each((rowIdx, row) => {
    const cells = $(row).find("td");
    if (cells.length < 4) return; // ヘッダー行 or データ不足行スキップ

    // sumodb ID & 四股名 (shikonaセルのリンクから取得)
    const shikonaCell = cells.eq(col.shikona);
    const link = shikonaCell.find("a[href*='r=']");
    const href = link.attr("href") ?? "";
    const idMatch = href.match(/[?&]r=(\d+)/i);
    if (!idMatch) return;

    const sumodbId = parseInt(idMatch[1]);
    const shikona = link.text().trim();
    if (!shikona || sumodbId <= 0) return;

    // 部屋 (Heyaリンクがある場合とテキストの場合)
    const heyaCell = cells.eq(col.heya);
    const heyaRaw = (heyaCell.find("a").text() || heyaCell.text()).trim();
    const heyaName = normalizeHeyaName(heyaRaw);

    // 出身地
    const shusshinRaw = cells.eq(col.shusshin).text().trim();
    const bornPlace   = normalizePlace(shusshinRaw);
    const nationality = inferNationality(shusshinRaw);

    // 生年 ("May 8, 1969" 形式)
    const bornYear = parseBirthYear(cells.eq(col.born).text().trim());

    // 初土俵 & 引退 ("1988.03" 形式)
    const activeFrom = parseBashoYear(cells.eq(col.debut).text().trim());
    const activeTo   = parseBashoYear(cells.eq(col.intai).text().trim());

    results.push({
      sumodbId,
      shikona,
      heyaName,
      bornPlace,
      bornYear,
      highestRank: rankValue,
      activeFrom,
      activeTo,
      nationality,
    });
  });

  return results;
}

/** ヘッダー候補からカラムインデックスを探す (部分一致含む) */
function findCol(headers: string[], candidates: string[], fallback: number): number {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h === c || h.includes(c) || c.includes(h));
    if (idx >= 0) return idx;
  }
  return fallback;
}

// ─── メイン処理 ──────────────────────────────────────────────────────────

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🏆  sumodb.sumogames.de スクレイパー");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (DRY_RUN)    console.log("   ⚡ DRY RUN モード（DB書き込みなし）");
  if (DEBUG_HTML) console.log("   🔍 DEBUG HTML モード");
  console.log(`   対象番付: ${RANK_PARAMS.map(r => r.label).join(", ")}`);
  console.log();

  // ─── Phase 1: スクレイピング ─────────────────────────────────

  const allRikishi: ScrapedRikishi[] = [];
  const heyaSet = new Set<string>();
  const seenIds = new Set<number>(); // 重複除去

  for (const { param, rank, label } of RANK_PARAMS) {
    process.stdout.write(`📋 ${label}リスト取得中... `);
    try {
      const list = await scrapeRikishiList(param, rank, label);
      // 重複除去
      const unique = list.filter(r => {
        if (seenIds.has(r.sumodbId)) return false;
        seenIds.add(r.sumodbId);
        return true;
      });
      for (const r of unique) heyaSet.add(r.heyaName);
      allRikishi.push(...unique);
      console.log(`${unique.length}名`);
    } catch (e) {
      console.error(`\n❌ ${label} エラー: ${e}`);
    }
    await sleep(DELAY_MS);
  }

  console.log();
  console.log(`📊 合計: ${allRikishi.length}名 / ${heyaSet.size}部屋`);

  if (allRikishi.length === 0) {
    console.error("\n❌ データが取得できませんでした。");
    console.error("   --debug-html オプションで再実行してHTML構造を確認してください。");
    process.exit(1);
  }

  // サンプル表示
  console.log("\n   先頭5件のサンプル:");
  for (const r of allRikishi.slice(0, 5)) {
    console.log(`   [${r.sumodbId}] ${r.shikona} / ${r.heyaName} / ${r.bornPlace ?? "不明"} / ${r.highestRank} / ${r.bornYear ?? "?"}年生 / ${r.activeFrom ?? "?"}〜${r.activeTo ?? "現役"}`);
  }

  if (DRY_RUN) {
    console.log("\n✅ DRY RUN完了。--dry-run フラグを外して実行するとDB投入されます。");
    return;
  }

  // ─── Phase 2: Supabase投入 ───────────────────────────────────

  console.log("\n🗑  既存データクリア...");
  // 外部キー制約の順序で削除
  const { error: relErr } = await supabase.from("relationships").delete().gte("created_at", "2000-01-01");
  if (relErr) console.warn("   relationships削除警告:", relErr.message);
  const { error: rikErr } = await supabase.from("rikishi").delete().gte("created_at", "2000-01-01");
  if (rikErr) console.warn("   rikishi削除警告:", rikErr.message);
  const { error: heyErr } = await supabase.from("heya").delete().gte("created_at", "2000-01-01");
  if (heyErr) console.warn("   heya削除警告:", heyErr.message);
  console.log("   ✅ クリア完了");

  // 部屋を投入
  console.log("\n⛩  部屋データ投入...");
  const heyaInserts = Array.from(heyaSet).map(name => ({ name }));
  const { data: heyaData, error: heyaErr2 } = await supabase
    .from("heya").insert(heyaInserts).select("id, name");
  if (heyaErr2) {
    console.error("部屋投入エラー:", heyaErr2);
    process.exit(1);
  }
  const heyaMap = new Map(heyaData!.map(h => [h.name, h.id]));
  console.log(`   ✅ ${heyaData!.length}部屋`);

  // 力士をバッチ投入
  console.log("\n💪 力士データ投入...");
  let totalInserted = 0;
  let totalErrors = 0;

  for (let i = 0; i < allRikishi.length; i += BATCH_SIZE) {
    const batch = allRikishi.slice(i, i + BATCH_SIZE).map(r => ({
      shikona:      r.shikona,
      heya_id:      heyaMap.get(r.heyaName) ?? null,
      born_place:   r.bornPlace,
      born_year:    r.bornYear,
      highest_rank: r.highestRank,
      active_from:  r.activeFrom,
      active_to:    r.activeTo,
      nationality:  r.nationality,
    }));

    const { data, error } = await supabase
      .from("rikishi").insert(batch).select("id");

    if (error) {
      console.error(`\n   バッチ${i}〜${i + BATCH_SIZE}エラー:`, error.message);
      totalErrors++;
    } else {
      totalInserted += data!.length;
    }

    process.stdout.write(`   ${totalInserted}/${allRikishi.length} 投入中...\r`);
    await sleep(100);
  }

  console.log(`\n   ✅ ${totalInserted}名 投入完了${totalErrors > 0 ? ` (エラー: ${totalErrors}バッチ)` : ""}`);

  // ─── 完了 ────────────────────────────────────────────────────

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎉 スクレイピング完了！");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   次のステップ:");
  console.log("   op run --env-file=.env.local -- npx tsx scripts/generate-relationships.ts");
}

main().catch(err => {
  console.error("致命的エラー:", err);
  process.exit(1);
});

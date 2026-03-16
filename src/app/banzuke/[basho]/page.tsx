"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Basho } from "@/types";
import { useAuthRole, hasRole } from "@/hooks/useAuthRole";

// ─── 型 ──────────────────────────────────────────────────────────────────────

interface RikishiInfo {
  id:        string;
  shikona:   string;
  photo_url: string | null;
  heya_id:   string | null;
  heya:      { name: string } | null;
}

interface BanzukeRow {
  id:           string;
  rikishi_id:   string;
  basho:        string;
  rank_class:   string;
  rank_number:  number | null;
  rank_side:    string | null;
  rank_display: string | null;
  rank_order:   number;
  rikishi:      RikishiInfo | null;
}

// ─── 定数 ────────────────────────────────────────────────────────────────────

const DIVISIONS = [
  { key: "makuuchi", label: "幕内",   classes: ["yokozuna","ozeki","sekiwake","komusubi","maegashira"] },
  { key: "juryo",    label: "十両",   classes: ["juryo"] },
  { key: "makushita",label: "幕下",   classes: ["makushita"] },
  { key: "sandanme", label: "三段目", classes: ["sandanme"] },
  { key: "jonidan",  label: "序二段", classes: ["jonidan"] },
  { key: "jonokuchi",label: "序ノ口", classes: ["jonokuchi"] },
] as const;

type DivKey = typeof DIVISIONS[number]["key"];

const RANK_JA: Record<string, string> = {
  yokozuna:   "横綱",
  ozeki:      "大関",
  sekiwake:   "関脇",
  komusubi:   "小結",
  maegashira: "前頭",
  juryo:      "十両",
  makushita:  "幕下",
  sandanme:   "三段目",
  jonidan:    "序二段",
  jonokuchi:  "序ノ口",
};

// 幕内の格 → 表示スタイル
const MAKUUCHI_STYLE: Record<string, { size: string; color: string }> = {
  yokozuna:   { size: "text-lg font-bold",     color: "text-enishi" },
  ozeki:      { size: "text-base font-bold",   color: "text-enishi" },
  sekiwake:   { size: "text-sm font-semibold", color: "text-enishi-light" },
  komusubi:   { size: "text-sm font-semibold", color: "text-ink" },
  maegashira: { size: "text-sm",               color: "text-ink" },
};

// ─── ユーティリティ ───────────────────────────────────────────────────────────

/** 東西ペアを [(east|null, west|null)] の配列に変換 */
function toPairs(entries: BanzukeRow[]): [BanzukeRow | null, BanzukeRow | null][] {
  const east = entries.filter(e => e.rank_side === "east");
  const west = entries.filter(e => e.rank_side === "west");
  const len  = Math.max(east.length, west.length);
  return Array.from({ length: len }, (_, i) => [east[i] ?? null, west[i] ?? null]);
}

// ─── 力士セル ─────────────────────────────────────────────────────────────────

function RikishiCell({
  entry,
  side,
  style,
}: {
  entry: BanzukeRow | null;
  side:  "east" | "west";
  style: { size: string; color: string };
}) {
  if (!entry) return <div className="flex-1" />;

  const textAlign = side === "east" ? "text-right" : "text-left";
  const flexDir   = side === "east" ? "flex-row-reverse" : "flex-row";

  return (
    <Link
      href={`/?rikishi=${entry.rikishi_id}`}
      className={`flex-1 flex ${flexDir} items-center gap-1 px-2 py-0.5
        hover:bg-enishi-pale rounded transition-colors group`}
    >
      <span className={`${style.size} ${style.color} ${textAlign} flex-1
        group-hover:text-enishi transition-colors leading-tight`}>
        {entry.rikishi?.shikona ?? "?"}
      </span>
      {entry.rank_display && (
        <span className="text-xs shrink-0 tabular-nums" style={{ color: "var(--ink-muted)" }}>
          {entry.rank_display}
        </span>
      )}
    </Link>
  );
}

// ─── 1行（東・番付・西） ──────────────────────────────────────────────────────

function BanzukeRow_({
  eastEntry,
  westEntry,
  rankLabel,
  style,
}: {
  eastEntry: BanzukeRow | null;
  westEntry: BanzukeRow | null;
  rankLabel: string;
  style:     { size: string; color: string };
}) {
  return (
    <div className="flex items-center min-h-[2rem]" style={{ borderBottom: "1px solid var(--border)" }}>
      <RikishiCell entry={eastEntry} side="east" style={style} />
      <div className="w-16 shrink-0 text-center">
        <span className="text-xs" style={{ color: "var(--ink-muted)" }}>{rankLabel}</span>
      </div>
      <RikishiCell entry={westEntry} side="west" style={style} />
    </div>
  );
}

// ─── 幕内ビュー ───────────────────────────────────────────────────────────────

function MakuuchiView({ entries }: { entries: BanzukeRow[] }) {
  // 上位陣（横綱〜小結）と前頭を分ける
  const upperClasses = ["yokozuna", "ozeki", "sekiwake", "komusubi"];
  const upper = entries.filter(e => upperClasses.includes(e.rank_class));
  const maegashira = entries.filter(e => e.rank_class === "maegashira");

  // 上位陣: rank_classごとにグループ化してペア表示
  const upperGroups: { cls: string; pairs: [BanzukeRow | null, BanzukeRow | null][] }[] = [];
  for (const cls of upperClasses) {
    const group = upper.filter(e => e.rank_class === cls);
    if (group.length === 0) continue;
    upperGroups.push({ cls, pairs: toPairs(group) });
  }

  const maePairs = toPairs(maegashira);

  return (
    <div>
      {/* 上位（横綱〜小結）: 格ごとに区切り線あり */}
      {upperGroups.map(({ cls, pairs }) => (
        <div key={cls} className="mb-1">
          {pairs.map(([e, w], i) => {
            const num = (e ?? w)?.rank_number;
            const label = `${RANK_JA[cls]}${num ? num : ""}`;
            return (
              <BanzukeRow_
                key={i}
                eastEntry={e}
                westEntry={w}
                rankLabel={label}
                style={MAKUUCHI_STYLE[cls]}
              />
            );
          })}
          <div className="my-1" style={{ borderBottom: "1px solid var(--border-dark)" }} />
        </div>
      ))}

      {/* 前頭 */}
      {maePairs.map(([e, w], i) => {
        const num = (e ?? w)?.rank_number ?? i + 1;
        return (
          <BanzukeRow_
            key={i}
            eastEntry={e}
            westEntry={w}
            rankLabel={`前頭${num}`}
            style={MAKUUCHI_STYLE["maegashira"]}
          />
        );
      })}
    </div>
  );
}

// ─── 一般部屋ビュー（十両〜序ノ口） ──────────────────────────────────────────

function SimpleView({ entries, rankClass }: { entries: BanzukeRow[]; rankClass: string }) {
  const pairs = toPairs(entries);
  const style = { size: "text-sm", color: "text-ink" };

  return (
    <div>
      {pairs.map(([e, w], i) => {
        const num = (e ?? w)?.rank_number ?? i + 1;
        return (
          <BanzukeRow_
            key={i}
            eastEntry={e}
            westEntry={w}
            rankLabel={`${RANK_JA[rankClass] ?? ""}${num}`}
            style={style}
          />
        );
      })}
      {pairs.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: "var(--ink-muted)" }}>データなし</p>
      )}
    </div>
  );
}

// ─── メインコンポーネント ─────────────────────────────────────────────────────

export default function BanzukePage() {
  const { basho: bashoParam } = useParams<{ basho: string }>();
  const router       = useRouter();
  const searchParams = useSearchParams();

  // ?div= クエリパラメータから初期タブを設定
  const divParam = searchParams.get("div") as DivKey | null;
  const validDivKeys = DIVISIONS.map(d => d.key) as readonly string[];
  const initialDiv: DivKey =
    divParam && validDivKeys.includes(divParam) ? divParam : "makuuchi";

  const { role } = useAuthRole();
  const canEdit = hasRole(role, "editor");

  const [bashoList, setBashoList]   = useState<Basho[]>([]);
  const [entries,   setEntries]     = useState<BanzukeRow[]>([]);
  const [bashoInfo, setBashoInfo]   = useState<Basho | null>(null);
  const [loading,   setLoading]     = useState(true);
  const [activeDiv, setActiveDiv]   = useState<DivKey>(initialDiv);

  // 場所一覧フェッチ
  useEffect(() => {
    fetch("/api/basho")
      .then(r => r.json())
      .then(d => setBashoList(d.basho ?? []));
  }, []);

  // 番付フェッチ
  const fetchBanzuke = useCallback((basho: string) => {
    setLoading(true);
    fetch(`/api/banzuke/${basho}`)
      .then(r => r.json())
      .then(d => {
        setBashoInfo(d.basho ?? null);
        setEntries(d.entries ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (bashoParam) fetchBanzuke(bashoParam);
  }, [bashoParam, fetchBanzuke]);

  const handleBashoChange = (id: string) => {
    router.push(`/banzuke/${id}`);
  };

  // アクティブ部屋のエントリを絞り込む
  const divDef = DIVISIONS.find(d => d.key === activeDiv)!;
  const divEntries = entries.filter(e => divDef.classes.includes(e.rank_class as never));

  // 各部屋のカウント（タブ表示用）
  const countByDiv: Record<DivKey, number> = {} as Record<DivKey, number>;
  for (const div of DIVISIONS) {
    countByDiv[div.key] = entries.filter(e => div.classes.includes(e.rank_class as never)).length;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--washi)", color: "var(--ink)" }}>
      {/* ヘッダー */}
      <header className="sticky top-0 z-20 px-4 py-3"
        style={{ backgroundColor: "var(--white)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/" className="text-sm transition-colors hover:text-enishi"
              style={{ color: "var(--ink-muted)" }}>
              相関図
            </Link>
            <span style={{ color: "var(--border-dark)" }}>|</span>
            <Link href="/admin/rikishi" className="text-sm transition-colors hover:text-enishi"
              style={{ color: "var(--ink-muted)" }}>
              力士
            </Link>
          </div>
          <h1 className="font-bold text-lg flex-1 text-center" style={{ color: "var(--purple)" }}>
            番付
          </h1>
          {canEdit ? (
            <Link
              href={`/banzuke/${bashoParam}/edit`}
              className="text-xs px-2 py-1 rounded transition-colors shrink-0 hover:text-enishi"
              style={{ backgroundColor: "var(--purple-pale)", color: "var(--purple)", border: "1px solid var(--border)" }}
            >
              編集
            </Link>
          ) : (
            <span
              className="text-xs px-2 py-1 rounded cursor-not-allowed shrink-0"
              style={{ backgroundColor: "var(--washi)", color: "var(--border-dark)", border: "1px solid var(--border)" }}
              title="editor 以上で利用可能"
            >
              🔒 編集
            </span>
          )}
          {/* 場所セレクト */}
          <select
            className="rounded px-2 py-1 text-sm focus:outline-none"
            style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink)" }}
            value={bashoParam}
            onChange={e => handleBashoChange(e.target.value)}
          >
            {bashoList.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-2 py-4">
        {/* 場所タイトル */}
        {bashoInfo && (
          <div className="text-center mb-4">
            <p className="text-xs" style={{ color: "var(--ink-muted)" }}>{bashoInfo.location}</p>
            <h2 className="text-xl font-bold" style={{ color: "var(--purple)", fontFamily: "'Noto Serif JP', serif" }}>{bashoInfo.name}</h2>
          </div>
        )}

        {/* 部屋タブ */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {DIVISIONS.map(div => (
            <button
              key={div.key}
              onClick={() => setActiveDiv(div.key)}
              className="shrink-0 px-3 py-1.5 rounded text-xs font-medium transition-colors"
              style={activeDiv === div.key
                ? { backgroundColor: "var(--purple)", color: "var(--white)" }
                : { backgroundColor: "var(--white)", color: "var(--ink)", border: "1px solid var(--border)" }}
            >
              {div.label}
              <span className="ml-1" style={{ color: activeDiv === div.key ? "rgba(255,255,255,0.7)" : "var(--ink-muted)" }}>
                {countByDiv[div.key] > 0 ? countByDiv[div.key] : ""}
              </span>
            </button>
          ))}
        </div>

        {/* ヘッダー行: 東 / 西 */}
        <div className="flex items-center mb-1">
          <div className="flex-1 text-center">
            <span className="text-xs font-bold text-red-400">東</span>
          </div>
          <div className="w-16 shrink-0" />
          <div className="flex-1 text-center">
            <span className="text-xs font-bold text-blue-400">西</span>
          </div>
        </div>

        {/* 番付本体 */}
        {loading ? (
          <div className="text-center py-16 text-sm" style={{ color: "var(--ink-muted)" }}>読み込み中...</div>
        ) : (
          <div className="rounded-lg overflow-hidden" style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)" }}>
            {activeDiv === "makuuchi" ? (
              <MakuuchiView entries={divEntries} />
            ) : (
              <SimpleView
                entries={divEntries}
                rankClass={divDef.classes[0]}
              />
            )}
          </div>
        )}

        {/* データなし */}
        {!loading && entries.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: "var(--ink-muted)" }}>この場所の番付データはまだ登録されていません</p>
              {canEdit && (
              <Link
                href={`/banzuke/${bashoParam}/edit`}
                className="inline-block mt-3 text-xs px-3 py-1.5 rounded transition-colors"
                style={{ backgroundColor: "var(--purple-pale)", color: "var(--purple)" }}
              >
                番付を編集する →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

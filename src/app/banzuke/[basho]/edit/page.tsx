"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Basho } from "@/types";
import RikishiCombobox from "@/components/RikishiCombobox";

// ─── 型 ──────────────────────────────────────────────────────────────────────

interface RikishiInfo {
  id:        string;
  shikona:   string;
  photo_url: string | null;
  heya_id:   string | null;
  heya:      { name: string } | null;
}

interface BanzukeEntry {
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
  yokozuna: "横綱", ozeki: "大関", sekiwake: "関脇", komusubi: "小結",
  maegashira: "前頭", juryo: "十両", makushita: "幕下",
  sandanme: "三段目", jonidan: "序二段", jonokuchi: "序ノ口",
};

// 幕内各格のデフォルト枚数（空の番付表を生成するときに使う）
const UPPER_COUNTS: Record<string, number> = {
  yokozuna: 2, ozeki: 2, sekiwake: 2, komusubi: 2,
};
const MAE_COUNT  = 17; // 前頭
const OTHER_COUNT = 14; // 十両〜序ノ口

// ─── スロットの一意キー ───────────────────────────────────────────────────────

function slotKey(rank_class: string, rank_number: number | null, rank_side: string | null) {
  return `${rank_class}__${rank_number ?? ""}__${rank_side ?? ""}`;
}

// ─── 編集可能なセル ───────────────────────────────────────────────────────────

function EditCell({
  entry,
  rankClass,
  rankNumber,
  side,
  bashoParam,
  onSaved,
}: {
  entry:      BanzukeEntry | null;
  rankClass:  string;
  rankNumber: number | null;
  side:       "east" | "west";
  bashoParam: string;
  onSaved:    (newEntry: BanzukeEntry | null, prevRikishiId: string | null) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [open, setOpen]     = useState(false);
  const prevIdRef = useRef<string | null>(entry?.rikishi_id ?? null);

  const currentId = entry?.rikishi_id ?? null;
  const label     = entry?.rikishi?.shikona ?? null;

  async function handleChange(newId: string | null) {
    const prevId = prevIdRef.current;

    // 変化なし
    if (newId === prevId) {
      setOpen(false);
      return;
    }

    setSaving(true);
    try {
      // 旧力士を削除（同じ場所の別スロット変更は PUT が上書きするが念のため）
      if (prevId) {
        await fetch(`/api/banzuke/${bashoParam}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rikishi_id: prevId }),
        });
      }

      if (newId) {
        // 新力士をアサイン
        const res = await fetch(`/api/banzuke/${bashoParam}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rikishi_id:  newId,
            rank_class:  rankClass,
            rank_number: rankNumber,
            rank_side:   side,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "保存失敗");
        const { entry: saved } = await res.json() as { entry: BanzukeEntry };
        prevIdRef.current = newId;
        onSaved(saved, prevId);
      } else {
        prevIdRef.current = null;
        onSaved(null, prevId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  const flexDir   = side === "east" ? "flex-row-reverse" : "flex-row";
  const textAlign = side === "east" ? "text-right" : "text-left";

  if (!open) {
    // 表示モード: クリックでコンボ開く
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex-1 flex ${flexDir} items-center gap-1 px-2 py-0.5 min-h-[2rem]
          rounded transition-colors group
          ${label
            ? "hover:bg-stone-700 text-stone-100"
            : "hover:bg-stone-800 border border-dashed border-stone-700 text-stone-600"}`}
      >
        <span className={`text-sm flex-1 ${textAlign} leading-tight group-hover:text-amber-400 transition-colors`}>
          {saving ? "…" : (label ?? "＋")}
        </span>
        {entry?.rank_display && (
          <span className="text-xs text-stone-600 shrink-0 tabular-nums">{entry.rank_display}</span>
        )}
      </button>
    );
  }

  // 編集モード: コンボボックス
  return (
    <div className="flex-1 px-1 py-0.5">
      <RikishiCombobox
        value={currentId}
        onChange={(id) => handleChange(id)}
        placeholder="力士名を入力"
        emptyLabel="（未配置にする）"
      />
    </div>
  );
}

// ─── 1行（東・番付・西） ──────────────────────────────────────────────────────

function EditRow({
  eastEntry,
  westEntry,
  rankLabel,
  rankClass,
  rankNumber,
  bashoParam,
  onSaved,
}: {
  eastEntry:  BanzukeEntry | null;
  westEntry:  BanzukeEntry | null;
  rankLabel:  string;
  rankClass:  string;
  rankNumber: number | null;
  bashoParam: string;
  onSaved:    (newEntry: BanzukeEntry | null, prevRikishiId: string | null) => void;
}) {
  return (
    <div className="flex items-center border-b border-stone-800/50 min-h-[2.5rem] gap-1">
      <EditCell
        entry={eastEntry}
        rankClass={rankClass}
        rankNumber={rankNumber}
        side="east"
        bashoParam={bashoParam}
        onSaved={onSaved}
      />
      <div className="w-16 shrink-0 text-center">
        <span className="text-xs text-stone-500">{rankLabel}</span>
      </div>
      <EditCell
        entry={westEntry}
        rankClass={rankClass}
        rankNumber={rankNumber}
        side="west"
        bashoParam={bashoParam}
        onSaved={onSaved}
      />
    </div>
  );
}

// ─── スロット生成ヘルパー ─────────────────────────────────────────────────────

/** entries を Map<slotKey, BanzukeEntry> に変換 */
function toMap(entries: BanzukeEntry[]): Map<string, BanzukeEntry> {
  const m = new Map<string, BanzukeEntry>();
  for (const e of entries) {
    m.set(slotKey(e.rank_class, e.rank_number, e.rank_side), e);
  }
  return m;
}

// ─── 幕内編集ビュー ───────────────────────────────────────────────────────────

function MakuuchiEditView({
  entries,
  bashoParam,
  onSaved,
}: {
  entries:    BanzukeEntry[];
  bashoParam: string;
  onSaved:    (newEntry: BanzukeEntry | null, prevRikishiId: string | null) => void;
}) {
  const m = toMap(entries);
  const upperClasses = ["yokozuna","ozeki","sekiwake","komusubi"] as const;

  return (
    <div>
      {/* 上位（横綱〜小結）*/}
      {upperClasses.map(cls => {
        const count = Math.max(
          UPPER_COUNTS[cls] ?? 2,
          entries.filter(e => e.rank_class === cls).length,
        );
        return (
          <div key={cls} className="mb-1">
            {Array.from({ length: count }, (_, i) => {
              const num = i + 1;
              const east = m.get(slotKey(cls, num, "east")) ?? null;
              const west = m.get(slotKey(cls, num, "west")) ?? null;
              return (
                <EditRow
                  key={i}
                  eastEntry={east}
                  westEntry={west}
                  rankLabel={`${RANK_JA[cls]}${num}`}
                  rankClass={cls}
                  rankNumber={num}
                  bashoParam={bashoParam}
                  onSaved={onSaved}
                />
              );
            })}
            <div className="border-b border-stone-700 my-1" />
          </div>
        );
      })}

      {/* 前頭 */}
      {(() => {
        const maeEntries = entries.filter(e => e.rank_class === "maegashira");
        const count = Math.max(MAE_COUNT, maeEntries.length);
        return Array.from({ length: count }, (_, i) => {
          const num = i + 1;
          const east = m.get(slotKey("maegashira", num, "east")) ?? null;
          const west = m.get(slotKey("maegashira", num, "west")) ?? null;
          return (
            <EditRow
              key={i}
              eastEntry={east}
              westEntry={west}
              rankLabel={`前頭${num}`}
              rankClass="maegashira"
              rankNumber={num}
              bashoParam={bashoParam}
              onSaved={onSaved}
            />
          );
        });
      })()}
    </div>
  );
}

// ─── 一般部屋編集ビュー ───────────────────────────────────────────────────────

function SimpleEditView({
  entries,
  rankClass,
  bashoParam,
  onSaved,
}: {
  entries:    BanzukeEntry[];
  rankClass:  string;
  bashoParam: string;
  onSaved:    (newEntry: BanzukeEntry | null, prevRikishiId: string | null) => void;
}) {
  const m = toMap(entries);
  const count = Math.max(OTHER_COUNT, entries.length);

  return (
    <div>
      {Array.from({ length: count }, (_, i) => {
        const num  = i + 1;
        const east = m.get(slotKey(rankClass, num, "east")) ?? null;
        const west = m.get(slotKey(rankClass, num, "west")) ?? null;
        return (
          <EditRow
            key={i}
            eastEntry={east}
            westEntry={west}
            rankLabel={`${RANK_JA[rankClass] ?? ""}${num}`}
            rankClass={rankClass}
            rankNumber={num}
            bashoParam={bashoParam}
            onSaved={onSaved}
          />
        );
      })}
    </div>
  );
}

// ─── メインコンポーネント ─────────────────────────────────────────────────────

export default function BanzukeEditPage() {
  const { basho: bashoParam } = useParams<{ basho: string }>();
  const router = useRouter();

  const [bashoList, setBashoList] = useState<Basho[]>([]);
  const [entries,   setEntries]   = useState<BanzukeEntry[]>([]);
  const [bashoInfo, setBashoInfo] = useState<Basho | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [activeDiv, setActiveDiv] = useState<DivKey>("makuuchi");

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

  /**
   * セルへの保存後に entries を差分更新する。
   * prevRikishiId: 削除された力士のID（null なら削除なし）
   * newEntry:      新しく配置された力士のエントリ（null なら空スロットにした）
   */
  const handleSaved = useCallback((
    newEntry: BanzukeEntry | null,
    prevRikishiId: string | null,
  ) => {
    setEntries(prev => {
      let next = [...prev];
      // 旧エントリを削除
      if (prevRikishiId) {
        next = next.filter(e => e.rikishi_id !== prevRikishiId);
      }
      // 新エントリを追加（rank_order を付加）
      if (newEntry) {
        const RANK_ORDER: Record<string, number> = {
          yokozuna:1,ozeki:2,sekiwake:3,komusubi:4,maegashira:5,
          juryo:6,makushita:7,sandanme:8,jonidan:9,jonokuchi:10,
        };
        next.push({
          ...newEntry,
          rank_order: RANK_ORDER[newEntry.rank_class] ?? 99,
        });
      }
      return next;
    });
  }, []);

  const divDef     = DIVISIONS.find(d => d.key === activeDiv)!;
  const divEntries = entries.filter(e => divDef.classes.includes(e.rank_class as never));

  const countByDiv: Record<DivKey, number> = {} as Record<DivKey, number>;
  for (const div of DIVISIONS) {
    countByDiv[div.key] = entries.filter(e => div.classes.includes(e.rank_class as never)).length;
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* ヘッダー */}
      <header className="sticky top-0 z-20 bg-stone-950 border-b border-stone-800 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link
            href={`/banzuke/${bashoParam}`}
            className="text-stone-400 hover:text-amber-400 text-sm transition-colors shrink-0"
          >
            ← 閲覧
          </Link>
          <h1 className="text-amber-400 font-bold text-lg flex-1 text-center">
            番付編集
          </h1>
          {/* 場所セレクト */}
          <select
            className="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-sm text-white
              focus:outline-none focus:border-amber-500 shrink-0"
            value={bashoParam}
            onChange={e => router.push(`/banzuke/${e.target.value}/edit`)}
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
            <p className="text-stone-400 text-xs">{bashoInfo.location}</p>
            <h2 className="text-xl font-bold text-amber-300">{bashoInfo.name}</h2>
            <p className="text-stone-500 text-xs mt-1">セルをクリックして力士を配置</p>
          </div>
        )}

        {/* 部屋タブ */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {DIVISIONS.map(div => (
            <button
              key={div.key}
              onClick={() => setActiveDiv(div.key)}
              className={`shrink-0 px-3 py-1.5 rounded text-xs font-medium transition-colors
                ${activeDiv === div.key
                  ? "bg-amber-600 text-white"
                  : "bg-stone-800 text-stone-300 hover:bg-stone-700"}`}
            >
              {div.label}
              <span className={`ml-1 ${activeDiv === div.key ? "text-amber-200" : "text-stone-500"}`}>
                {countByDiv[div.key] > 0 ? countByDiv[div.key] : ""}
              </span>
            </button>
          ))}
        </div>

        {/* ヘッダー行 */}
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
          <div className="text-center py-16 text-stone-500 text-sm">読み込み中...</div>
        ) : (
          <div className="bg-stone-900 rounded-lg overflow-hidden">
            {activeDiv === "makuuchi" ? (
              <MakuuchiEditView
                entries={divEntries}
                bashoParam={bashoParam}
                onSaved={handleSaved}
              />
            ) : (
              <SimpleEditView
                entries={divEntries}
                rankClass={divDef.classes[0]}
                bashoParam={bashoParam}
                onSaved={handleSaved}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

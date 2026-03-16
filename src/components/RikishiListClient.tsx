"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface RikishiRow {
  id:           string;
  shikona:      string;
  yomigana:     string | null;
  highest_rank: string | null;
  active_from_basho: string | null;
  retirement_basho: string | null;
  status:       string;
  nationality:  string | null;
  heya: { id: string; name: string; ichimon: string | null } | null;
}

const RANK_LABEL: Record<string, string> = {
  yokozuna:   "横綱", ozeki:    "大関", sekiwake:  "関脇",
  komusubi:   "小結", maegashira: "前頭", juryo:  "十両",
  makushita:  "幕下", sandanme: "三段目", jonidan: "序二段",
  jonokuchi:  "序ノ口",
};

const RANK_COLOR: Record<string, string> = {
  yokozuna:   "text-amber-400",
  ozeki:      "text-orange-400",
  sekiwake:   "text-violet-400",
  komusubi:   "text-blue-400",
  maegashira: "text-green-400",
};

type SortKey = "shikona" | "active_from_basho" | "retirement_basho" | "heya" | "highest_rank";
type SortDir = "asc" | "desc";

interface Props {
  initialRows: RikishiRow[];
  heyaOptions: { id: string; name: string; ichimon: string | null }[];
}

export default function RikishiListClient({ initialRows, heyaOptions }: Props) {
  const [query,       setQuery]       = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "retired">("all");
  const [heyaFilter,  setHeyaFilter]  = useState("");
  const [ichimonFilter, setIchimonFilter] = useState("");
  const [sortKey,     setSortKey]     = useState<SortKey>("shikona");
  const [sortDir,     setSortDir]     = useState<SortDir>("asc");

  // 一門リストを部屋から生成
  const ichimonOptions = useMemo(() => {
    const set = new Set<string>();
    heyaOptions.forEach(h => { if (h.ichimon) set.add(h.ichimon); });
    return Array.from(set).sort();
  }, [heyaOptions]);

  // フィルタ & ソート
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = initialRows.filter(r => {
      if (q && !r.shikona.toLowerCase().includes(q) &&
          !(r.yomigana ?? "").toLowerCase().includes(q)) return false;
      if (statusFilter === "active"  && r.status !== "active")  return false;
      if (statusFilter === "retired" && r.status !== "retired") return false;
      if (heyaFilter  && r.heya?.id !== heyaFilter)  return false;
      if (ichimonFilter && r.heya?.ichimon !== ichimonFilter) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      let va: string | number | null = null;
      let vb: string | number | null = null;
      switch (sortKey) {
        case "shikona":      va = a.shikona;      vb = b.shikona;      break;
        case "active_from_basho": va = a.active_from_basho; vb = b.active_from_basho; break;
        case "retirement_basho": va = a.retirement_basho; vb = b.retirement_basho; break;
        case "heya":         va = a.heya?.name ?? ""; vb = b.heya?.name ?? ""; break;
        case "highest_rank": va = a.highest_rank ?? ""; vb = b.highest_rank ?? ""; break;
      }
      if (va === null || va === "") return sortDir === "asc" ? 1 : -1;
      if (vb === null || vb === "") return sortDir === "asc" ? -1 : 1;
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [initialRows, query, statusFilter, heyaFilter, ichimonFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }
  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <span className="text-stone-700 ml-1">⇅</span>;
    return <span className="text-amber-400 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const activeCount  = initialRows.filter(r => r.status === "active").length;
  const retiredCount = initialRows.filter(r => r.status === "retired").length;

  return (
    <div className="flex flex-col gap-4">
      {/* フィルターバー */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* テキスト検索 */}
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-500 text-sm pointer-events-none">🔍</span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="四股名・読み仮名で検索"
            className="bg-stone-900 border border-stone-700 rounded-lg pl-8 pr-3 py-1.5
              text-sm text-white placeholder:text-stone-500 focus:outline-none focus:border-amber-500 w-52"
          />
        </div>

        {/* ステータス */}
        <div className="flex rounded-lg overflow-hidden border border-stone-700">
          {(["all", "active", "retired"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors
                ${statusFilter === s
                  ? "bg-amber-600 text-white"
                  : "bg-stone-900 text-stone-400 hover:bg-stone-800"}`}
            >
              {s === "all" ? "全員" : s === "active" ? "現役" : "引退"}
            </button>
          ))}
        </div>

        {/* 部屋 */}
        <select
          value={heyaFilter}
          onChange={e => { setHeyaFilter(e.target.value); setIchimonFilter(""); }}
          className="bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5
            text-sm text-white focus:outline-none focus:border-amber-500"
        >
          <option value="">部屋: 全部</option>
          {heyaOptions.map(h => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>

        {/* 一門 */}
        <select
          value={ichimonFilter}
          onChange={e => { setIchimonFilter(e.target.value); setHeyaFilter(""); }}
          className="bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5
            text-sm text-white focus:outline-none focus:border-amber-500"
        >
          <option value="">一門: 全部</option>
          {ichimonOptions.map(i => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>

        {/* リセット */}
        {(query || statusFilter !== "all" || heyaFilter || ichimonFilter) && (
          <button
            onClick={() => { setQuery(""); setStatusFilter("all"); setHeyaFilter(""); setIchimonFilter(""); }}
            className="text-xs text-stone-500 hover:text-stone-300 underline"
          >
            リセット
          </button>
        )}

        <span className="ml-auto text-xs text-stone-500">
          {rows.length}人表示
          <span className="ml-2 text-stone-600">（現役 {activeCount} / 引退 {retiredCount}）</span>
        </span>
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto rounded-xl border border-stone-800">
        <table className="w-full text-sm">
          <thead className="bg-stone-900 border-b border-stone-800">
            <tr>
              <th className="text-left px-4 py-2.5 text-stone-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => toggleSort("shikona")}>
                四股名{sortIcon("shikona")}
              </th>
              <th className="text-left px-4 py-2.5 text-stone-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => toggleSort("heya")}>
                部屋{sortIcon("heya")}
              </th>
              <th className="text-left px-4 py-2.5 text-stone-400 font-medium">ステータス</th>
              <th className="text-left px-4 py-2.5 text-stone-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => toggleSort("highest_rank")}>
                最高位{sortIcon("highest_rank")}
              </th>
              <th className="text-left px-4 py-2.5 text-stone-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => toggleSort("active_from_basho")}>
                初土俵{sortIcon("active_from_basho")}
              </th>
              <th className="text-left px-4 py-2.5 text-stone-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => toggleSort("retirement_basho")}>
                引退場所{sortIcon("retirement_basho")}
              </th>
              <th className="text-right px-4 py-2.5 text-stone-400 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800/50">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-stone-500">
                  該当する力士がいません
                </td>
              </tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-stone-900/60 transition-colors">
                {/* 四股名 */}
                <td className="px-4 py-2.5">
                  <div className="font-medium text-white">{r.shikona}</div>
                  {r.yomigana && (
                    <div className="text-xs text-stone-500">{r.yomigana}</div>
                  )}
                  {r.nationality && r.nationality !== "日本" && (
                    <div className="text-xs text-stone-600">{r.nationality}</div>
                  )}
                </td>
                {/* 部屋 */}
                <td className="px-4 py-2.5 text-stone-300">
                  {r.heya?.name ?? <span className="text-stone-600">—</span>}
                  {r.heya?.ichimon && (
                    <div className="text-xs text-stone-600">{r.heya.ichimon}</div>
                  )}
                </td>
                {/* ステータス */}
                <td className="px-4 py-2.5">
                  {r.status === "active" ? (
                    <span className="inline-flex items-center gap-1 bg-green-900/40 border border-green-700/40
                      text-green-400 text-xs px-2 py-0.5 rounded-full">
                      ● 現役
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-stone-800/60 border border-stone-700/40
                      text-stone-500 text-xs px-2 py-0.5 rounded-full">
                      ○ 引退
                    </span>
                  )}
                </td>
                {/* 最高位 */}
                <td className="px-4 py-2.5">
                  {r.highest_rank ? (
                    <span className={`text-sm font-medium ${RANK_COLOR[r.highest_rank] ?? "text-stone-300"}`}>
                      {RANK_LABEL[r.highest_rank] ?? r.highest_rank}
                    </span>
                  ) : (
                    <span className="text-stone-600">—</span>
                  )}
                </td>
                {/* 入幕年 */}
                <td className="px-4 py-2.5 text-stone-400 text-sm">
                  {r.active_from_basho ?? <span className="text-stone-600">—</span>}
                </td>
                {/* 引退年 */}
                <td className="px-4 py-2.5 text-stone-400 text-sm">
                  {r.retirement_basho ?? <span className="text-stone-600">—</span>}
                </td>
                {/* 操作 */}
                <td className="px-4 py-2.5">
                  <div className="flex gap-2 justify-end">
                    <Link
                      href={`/rikishi/${r.id}/edit`}
                      className="text-xs px-2.5 py-1 bg-amber-600/20 border border-amber-600/40
                        text-amber-400 hover:bg-amber-600/30 rounded transition-colors"
                    >
                      編集
                    </Link>
                    <Link
                      href={`/?rikishi=${r.id}`}
                      className="text-xs px-2.5 py-1 bg-stone-800 border border-stone-700
                        text-stone-400 hover:text-stone-200 hover:bg-stone-700 rounded transition-colors"
                    >
                      相関図
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

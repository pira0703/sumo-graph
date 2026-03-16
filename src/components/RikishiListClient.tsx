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
  yokozuna:   "text-enishi",
  ozeki:      "text-orange-600",
  sekiwake:   "text-violet-600",
  komusubi:   "text-blue-600",
  maegashira: "text-green-700",
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
    if (sortKey !== key) return <span className="ml-1" style={{ color: "var(--border-dark)" }}>⇅</span>;
    return <span className="ml-1" style={{ color: "var(--purple)" }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const activeCount  = initialRows.filter(r => r.status === "active").length;
  const retiredCount = initialRows.filter(r => r.status === "retired").length;

  return (
    <div className="flex flex-col gap-4">
      {/* フィルターバー */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* テキスト検索 */}
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none" style={{ color: "var(--ink-muted)" }}>🔍</span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="四股名・読み仮名で検索"
            className="rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none w-52"
            style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink)" }}
          />
        </div>

        {/* ステータス */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {(["all", "active", "retired"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={statusFilter === s
                ? { backgroundColor: "var(--purple)", color: "var(--white)" }
                : { backgroundColor: "var(--white)", color: "var(--ink-muted)" }}
            >
              {s === "all" ? "全員" : s === "active" ? "現役" : "引退"}
            </button>
          ))}
        </div>

        {/* 部屋 */}
        <select
          value={heyaFilter}
          onChange={e => { setHeyaFilter(e.target.value); setIchimonFilter(""); }}
          className="rounded-lg px-3 py-1.5 text-sm focus:outline-none"
          style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink)" }}
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
          className="rounded-lg px-3 py-1.5 text-sm focus:outline-none"
          style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink)" }}
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
            className="text-xs underline"
            style={{ color: "var(--ink-muted)" }}
          >
            リセット
          </button>
        )}

        <span className="ml-auto text-xs" style={{ color: "var(--ink-muted)" }}>
          {rows.length}人表示
          <span className="ml-2" style={{ color: "var(--border-dark)" }}>（現役 {activeCount} / 引退 {retiredCount}）</span>
        </span>
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: "var(--washi)", borderBottom: "1px solid var(--border)" }}>
            <tr>
              <th className="text-left px-4 py-2.5 font-medium cursor-pointer hover:text-enishi"
                  style={{ color: "var(--ink-muted)" }} onClick={() => toggleSort("shikona")}>
                四股名{sortIcon("shikona")}
              </th>
              <th className="text-left px-4 py-2.5 font-medium cursor-pointer hover:text-enishi"
                  style={{ color: "var(--ink-muted)" }} onClick={() => toggleSort("heya")}>
                部屋{sortIcon("heya")}
              </th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--ink-muted)" }}>ステータス</th>
              <th className="text-left px-4 py-2.5 font-medium cursor-pointer hover:text-enishi"
                  style={{ color: "var(--ink-muted)" }} onClick={() => toggleSort("highest_rank")}>
                最高位{sortIcon("highest_rank")}
              </th>
              <th className="text-left px-4 py-2.5 font-medium cursor-pointer hover:text-enishi"
                  style={{ color: "var(--ink-muted)" }} onClick={() => toggleSort("active_from_basho")}>
                初土俵{sortIcon("active_from_basho")}
              </th>
              <th className="text-left px-4 py-2.5 font-medium cursor-pointer hover:text-enishi"
                  style={{ color: "var(--ink-muted)" }} onClick={() => toggleSort("retirement_basho")}>
                引退場所{sortIcon("retirement_basho")}
              </th>
              <th className="text-right px-4 py-2.5 font-medium" style={{ color: "var(--ink-muted)" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center" style={{ color: "var(--ink-muted)" }}>
                  該当する力士がいません
                </td>
              </tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="transition-colors hover:bg-enishi-pale" style={{ borderTop: "1px solid var(--border)" }}>
                {/* 四股名 */}
                <td className="px-4 py-2.5">
                  <div className="font-medium" style={{ color: "var(--ink)" }}>{r.shikona}</div>
                  {r.yomigana && (
                    <div className="text-xs" style={{ color: "var(--ink-muted)" }}>{r.yomigana}</div>
                  )}
                  {r.nationality && r.nationality !== "日本" && (
                    <div className="text-xs" style={{ color: "var(--border-dark)" }}>{r.nationality}</div>
                  )}
                </td>
                {/* 部屋 */}
                <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                  {r.heya?.name ?? <span style={{ color: "var(--border-dark)" }}>—</span>}
                  {r.heya?.ichimon && (
                    <div className="text-xs" style={{ color: "var(--ink-muted)" }}>{r.heya.ichimon}</div>
                  )}
                </td>
                {/* ステータス */}
                <td className="px-4 py-2.5">
                  {r.status === "active" ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "#F0FDF4", border: "1px solid #86EFAC", color: "#16A34A" }}>
                      ● 現役
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "var(--washi)", border: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                      ○ 引退
                    </span>
                  )}
                </td>
                {/* 最高位 */}
                <td className="px-4 py-2.5">
                  {r.highest_rank ? (
                    <span className={`text-sm font-medium ${RANK_COLOR[r.highest_rank] ?? "text-ink"}`}>
                      {RANK_LABEL[r.highest_rank] ?? r.highest_rank}
                    </span>
                  ) : (
                    <span style={{ color: "var(--border-dark)" }}>—</span>
                  )}
                </td>
                {/* 入幕年 */}
                <td className="px-4 py-2.5 text-sm" style={{ color: "var(--ink-muted)" }}>
                  {r.active_from_basho ?? <span style={{ color: "var(--border-dark)" }}>—</span>}
                </td>
                {/* 引退年 */}
                <td className="px-4 py-2.5 text-sm" style={{ color: "var(--ink-muted)" }}>
                  {r.retirement_basho ?? <span style={{ color: "var(--border-dark)" }}>—</span>}
                </td>
                {/* 操作 */}
                <td className="px-4 py-2.5">
                  <div className="flex gap-2 justify-end">
                    <Link
                      href={`/rikishi/${r.id}/edit`}
                      className="text-xs px-2.5 py-1 rounded transition-colors"
                      style={{ backgroundColor: "var(--purple-pale)", border: "1px solid var(--purple)", color: "var(--purple)" }}
                    >
                      編集
                    </Link>
                    <Link
                      href={`/?rikishi=${r.id}`}
                      className="text-xs px-2.5 py-1 rounded transition-colors"
                      style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink-muted)" }}
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

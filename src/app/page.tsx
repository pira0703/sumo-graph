"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import FilterPanel from "@/components/FilterPanel";
import GraphSearch from "@/components/GraphSearch";
import RikishiDetail from "@/components/RikishiDetail";
import AuthButton from "@/components/AuthButton";
import PreviewRoleBanner from "@/components/PreviewRoleBanner";
import { LINK_COLORS } from "@/constants/linkColors";
import { getRegion, getAgeGroup } from "@/constants/regions";
import { CURATED_THEMES, pickRandomTheme, type CuratedTheme } from "@/constants/themes";
import type { FilterState, GraphData, GraphNode, RelationType } from "@/types";
import { RANK_DIVISION_CLASSES } from "@/types";
import { useAuthRole, hasRole, type Role } from "@/hooks/useAuthRole";

function getLinkNodeId(endpoint: string | { id: string }): string {
  return typeof endpoint === "object" ? endpoint.id : endpoint;
}

const SumoGraph = dynamic(() => import("@/components/SumoGraph"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-stone-500 text-sm">
      相関図を読み込み中...
    </div>
  ),
});

const EMPTY_FILTER: FilterState = {
  heyas:           [],
  ichimons:        [],
  relation_types:  [],
  era:             "現役",
  rankDivisions:   ["幕内", "十両"],
  educations:      [],
  regions:         [],
  ageGroups:       [],
  careerTrends:    [],
  careerStages:    [],
  promotionSpeeds: [],
};

function applyTheme(theme: CuratedTheme): FilterState {
  const base = { ...EMPTY_FILTER, ...theme.filter } as FilterState;
  if (theme.showAllRanks) base.rankDivisions = [];
  return base;
}

const TODAY = new Date();

function matchesClientFilter(node: GraphNode, filter: FilterState): boolean {
  if (filter.regions.length > 0) {
    const region = getRegion(node.born_place);
    if (!region || !filter.regions.includes(region)) return false;
  }
  if (filter.educations.length > 0) {
    const hasUniv = !!node.university;
    const hasHigh = !!node.high_school;
    const edu = hasUniv ? "大卒" : hasHigh ? "高卒" : "中卒";
    if (!filter.educations.includes(edu as "中卒" | "高卒" | "大卒")) return false;
  }
  if (filter.ageGroups.length > 0) {
    const ag = getAgeGroup(node.birth_date, TODAY);
    if (!ag || !filter.ageGroups.includes(ag)) return false;
  }
  if (filter.careerTrends.length > 0) {
    if (!node.career_trend || !filter.careerTrends.includes(node.career_trend as import("@/types").CareerTrend)) return false;
  }
  if (filter.careerStages.length > 0) {
    if (!node.career_stage || !filter.careerStages.includes(node.career_stage as import("@/types").CareerStage)) return false;
  }
  if (filter.promotionSpeeds.length > 0) {
    if (!node.promotion_speed || !filter.promotionSpeeds.includes(node.promotion_speed as import("@/types").PromotionSpeed)) return false;
  }
  return true;
}

// ─── HomePageContent ──────────────────────────────────────────────────────────
function HomePageContent() {
  const searchParams = useSearchParams();
  const pendingFocusRef = useRef<string | null>(searchParams.get("rikishi"));

  const [graphData, setGraphData]     = useState<GraphData>({ nodes: [], links: [] });
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [heyaOptions, setHeyaOptions] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading]         = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ─ 認証・ロール
  const { role } = useAuthRole();
  const [previewRole, setPreviewRole] = useState<Role>("admin");
  const effectiveRole: Role = role === "admin" ? previewRole : role;

  // ─ テーマパネルのドラッグ位置（null = 未初期化、マウント後に中央へ）
  const [themePos, setThemePos] = useState<{ x: number; y: number } | null>(null);
  const themeDragOffset = useRef({ x: 0, y: 0 });

  // マウント後: グラフエリア中央に配置
  useEffect(() => {
    const PANEL_W = 360;
    const sidebarW = 256;
    const graphW = window.innerWidth - sidebarW;
    const x = Math.max(16, (graphW - PANEL_W) / 2);
    setThemePos({ x, y: 24 });
  }, []);

  const handleThemePanelDragStart = useCallback((e: React.MouseEvent) => {
    if (!themePos) return;
    e.stopPropagation();
    e.preventDefault();
    themeDragOffset.current = { x: e.clientX - themePos.x, y: e.clientY - themePos.y };
    const handleMove = (ev: MouseEvent) => {
      setThemePos({ x: ev.clientX - themeDragOffset.current.x, y: ev.clientY - themeDragOffset.current.y });
    };
    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themePos]);

  const [hiddenWarning, setHiddenWarning] = useState<{ id: string; shikona: string } | null>(null);
  const [fullGraphData, setFullGraphData] = useState<GraphData | null>(null);

  const [activeTheme, setActiveTheme] = useState<CuratedTheme>(CURATED_THEMES[0]);
  const [filter, setFilter]           = useState<FilterState>(() => applyTheme(CURATED_THEMES[0]));
  const [fetchedThemes, setFetchedThemes] = useState<CuratedTheme[] | null>(null);

  useEffect(() => {
    fetch("/api/themes")
      .then((r) => r.json())
      .then((rows: Array<{
        id: string; emoji: string; label: string; description: string;
        filter_config: Partial<FilterState>; show_all_ranks: boolean;
      }>) => {
        if (Array.isArray(rows) && rows.length > 0) {
          const themes: CuratedTheme[] = rows.map((row) => ({
            id: row.id, emoji: row.emoji, label: row.label,
            description: row.description, filter: row.filter_config,
            showAllRanks: row.show_all_ranks,
          }));
          setFetchedThemes(themes);
          const theme = themes[Math.floor(Math.random() * themes.length)];
          setActiveTheme(theme);
          setFilter(applyTheme(theme));
        } else {
          const theme = pickRandomTheme();
          setActiveTheme(theme);
          setFilter(applyTheme(theme));
        }
      })
      .catch(() => {
        const theme = pickRandomTheme();
        setActiveTheme(theme);
        setFilter(applyTheme(theme));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyNewTheme = useCallback((theme: CuratedTheme) => {
    setActiveTheme(theme);
    setFilter(applyTheme(theme));
    setSelectedId(null);
    setHiddenWarning(null);
  }, []);

  const handleReshuffle = useCallback(() => {
    const pool = fetchedThemes ?? CURATED_THEMES;
    const candidates = pool.filter((t) => t.id !== activeTheme.id);
    const next = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : pool[Math.floor(Math.random() * pool.length)];
    applyNewTheme(next);
  }, [activeTheme.id, applyNewTheme, fetchedThemes]);

  const visibleGraphData = useMemo<GraphData>(() => {
    const hasClientFilter =
      filter.regions.length > 0 || filter.educations.length > 0 ||
      filter.ageGroups.length > 0 || filter.careerTrends.length > 0 ||
      filter.careerStages.length > 0 || filter.promotionSpeeds.length > 0;

    const clientFiltered: GraphData = hasClientFilter ? (() => {
      const visibleIds = new Set(
        graphData.nodes.filter((n) => matchesClientFilter(n, filter)).map((n) => n.id)
      );
      return {
        nodes: graphData.nodes.filter((n) => visibleIds.has(n.id)),
        links: graphData.links.filter((l) =>
          visibleIds.has(getLinkNodeId(l.source)) && visibleIds.has(getLinkNodeId(l.target))
        ),
      };
    })() : graphData;

    if (!selectedId) {
      if (filter.rankDivisions.length > 0) {
        const allowed = new Set(filter.rankDivisions.flatMap((d) => RANK_DIVISION_CLASSES[d] ?? []));
        const visibleIds = new Set(
          clientFiltered.nodes.filter((n) => allowed.has(n.rank ?? "")).map((n) => n.id)
        );
        return {
          nodes: clientFiltered.nodes.filter((n) => visibleIds.has(n.id)),
          links: clientFiltered.links.filter((l) =>
            visibleIds.has(getLinkNodeId(l.source)) && visibleIds.has(getLinkNodeId(l.target))
          ),
        };
      }
      return clientFiltered;
    }

    const source = fullGraphData ?? graphData;
    const neighborWeights = new Map<string, number>();
    for (const link of source.links) {
      const src = getLinkNodeId(link.source);
      const tgt = getLinkNodeId(link.target);
      const w = link.weight ?? 1;
      if (src === selectedId) neighborWeights.set(tgt, Math.max(neighborWeights.get(tgt) ?? 0, w));
      if (tgt === selectedId) neighborWeights.set(src, Math.max(neighborWeights.get(src) ?? 0, w));
    }
    const neighborIds = new Set(
      [...neighborWeights.entries()].filter(([, w]) => w >= 2).map(([id]) => id)
    );
    const visibleIds = new Set([selectedId, ...neighborIds]);
    return {
      nodes: source.nodes.filter((n) => visibleIds.has(n.id)),
      links: source.links.filter((l) => {
        const src = getLinkNodeId(l.source);
        const tgt = getLinkNodeId(l.target);
        return (src === selectedId && neighborIds.has(tgt)) || (tgt === selectedId && neighborIds.has(src));
      }),
    };
  }, [graphData, fullGraphData, selectedId, filter]);

  useEffect(() => {
    fetch("/api/heya").then((r) => r.json()).then(setHeyaOptions).catch(() => {});
  }, []);

  const fetchGraph = useCallback(async (f: FilterState) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      for (const id of f.heyas) params.append("heya", id);
      for (const name of f.ichimons) params.append("ichimon", name);
      for (const rt of f.relation_types) params.append("relation_type", rt);
      if (f.era !== "全員") params.set("era", f.era);
      const res  = await fetch(`/api/graph?${params}`);
      const data = await res.json();
      setGraphData({
        nodes: Array.isArray(data.nodes) ? data.nodes : [],
        links: Array.isArray(data.links) ? data.links : [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph(filter);
    setHiddenWarning(null);
  }, [filter, fetchGraph]);

  useEffect(() => {
    if (!selectedId || fullGraphData) return;
    fetch("/api/graph?era=全員")
      .then((r) => r.json())
      .then((data) => {
        setFullGraphData({
          nodes: Array.isArray(data.nodes) ? data.nodes : [],
          links: Array.isArray(data.links) ? data.links : [],
        });
      })
      .catch(() => {});
  }, [selectedId, fullGraphData]);

  useEffect(() => {
    if (!pendingFocusRef.current || graphData.nodes.length === 0) return;
    const targetId = pendingFocusRef.current;
    if (graphData.nodes.some((n) => n.id === targetId)) {
      setSelectedId(targetId);
      pendingFocusRef.current = null;
    }
  }, [graphData.nodes]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedId(node.id);
    setHiddenWarning(null);
  }, []);

  const handleSearch = useCallback(
    (id: string, rikishi: { shikona: string }) => {
      setSelectedId(id);
      if (!graphData.nodes.some((n) => n.id === id)) {
        setHiddenWarning({ id, shikona: rikishi.shikona });
      } else {
        setHiddenWarning(null);
      }
    },
    [graphData.nodes]
  );

  const handleFilterChange = useCallback((f: FilterState) => setFilter(f), []);

  const canAccessBanzuke = hasRole(effectiveRole, "paid");
  const canAccessAdmin   = hasRole(effectiveRole, "editor");
  const canEdit          = hasRole(effectiveRole, "editor");

  return (
    <div className="flex h-screen overflow-hidden relative" style={{ backgroundColor: "var(--washi)" }}>

      {/* admin なりすましバナー */}
      {role === "admin" && (
        <PreviewRoleBanner previewRole={previewRole} onChangePreview={setPreviewRole} />
      )}

      {/* 左サイドバー */}
      <div className={`flex-shrink-0 transition-all duration-300 ${sidebarOpen ? "w-64" : "w-0 overflow-hidden"} ${role === "admin" ? "pt-9" : ""}`}>
        <div className="w-64 h-full flex flex-col p-3 gap-3 overflow-y-auto border-r" style={{ backgroundColor: "var(--white)", borderColor: "var(--border)" }}>

          {/* タイトル + ログインボタン */}
          <div className="pt-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              {/* えにし 円相ロゴ */}
              <div className="flex items-center gap-2">
                <svg width="36" height="36" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                  <path d="M48,12 C68,10 82,24 84,44 C86,64 74,80 55,85 C36,90 18,80 12,62 C6,44 14,24 28,16 C36,11 44,12 48,12"
                    fill="none" stroke="#5B3A8A" strokeWidth="5" strokeLinecap="round"/>
                  <circle cx="36" cy="52" r="5" fill="#5B3A8A" opacity=".7"/>
                  <circle cx="60" cy="52" r="5" fill="#5B3A8A" opacity=".7"/>
                  <line x1="41" y1="52" x2="55" y2="52" stroke="#C8982A" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                <h1 className="font-bold text-xl" style={{ color: "var(--purple)", fontFamily: "'Noto Serif JP', serif" }}>えにし</h1>
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-muted)" }}>
                {selectedId
                  ? `フォーカス中 • ${visibleGraphData.nodes.length}人`
                  : filter.rankDivisions.length === 0
                    ? `全番付 • ${visibleGraphData.nodes.length}人 / ${visibleGraphData.links.length}件`
                    : `${filter.rankDivisions.join("+")} • ${visibleGraphData.nodes.length}人 / ${visibleGraphData.links.length}件`}
              </p>
            </div>
            <div className="flex-shrink-0 pt-1">
              <AuthButton />
            </div>
          </div>

          {/* ナビゲーション */}
          <div className="flex gap-1.5">
            <span className="flex-1 text-center text-xs px-2 py-1.5 rounded font-medium" style={{ backgroundColor: "var(--purple-pale)", border: "1px solid var(--purple)", color: "var(--purple)" }}>
              相関図
            </span>
            {canAccessBanzuke ? (
              <Link href="/banzuke" className="flex-1 text-center text-xs px-2 py-1.5 rounded font-medium transition-colors" style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--purple)"; (e.currentTarget as HTMLElement).style.color = "var(--purple)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--ink)"; }}>
                番付
              </Link>
            ) : (
              <span className="flex-1 text-center text-xs px-2 py-1.5 rounded font-medium cursor-default flex items-center justify-center gap-0.5" style={{ backgroundColor: "var(--washi)", border: "1px solid var(--border)", color: "var(--border-dark)" }} title="有料プランで解禁">
                🔒 番付
              </span>
            )}
            {canAccessAdmin ? (
              <Link href="/admin" className="flex-1 text-center text-xs px-2 py-1.5 rounded font-medium transition-colors" style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--purple)"; (e.currentTarget as HTMLElement).style.color = "var(--purple)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--ink)"; }}>
                管理
              </Link>
            ) : (
              <span className="flex-1 text-center text-xs px-2 py-1.5 rounded font-medium cursor-default" style={{ backgroundColor: "var(--washi)", border: "1px solid var(--border)", color: "var(--border-dark)" }} title="editor 以上で利用可能">
                🔒 管理
              </span>
            )}
          </div>

          {/* 絞り込みパネル */}
          {canAccessBanzuke ? (
            <FilterPanel filter={filter} onChange={handleFilterChange} heyaOptions={heyaOptions} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl text-center" style={{ backgroundColor: "var(--washi)", border: "1px solid var(--border)" }}>
              <span className="text-2xl">🔒</span>
              <p className="text-xs font-medium" style={{ color: "var(--ink-muted)" }}>絞り込みは有料プラン</p>
              <p className="text-xs leading-relaxed px-2" style={{ color: "var(--border-dark)" }}>
                部屋・一門・出身地など<br />詳細フィルターを利用できます
              </p>
            </div>
          )}

          <Legend />
        </div>
      </div>

      {/* サイドバー開閉ボタン */}
      <button
        onClick={() => setSidebarOpen((v) => !v)}
        className="absolute z-20 w-5 h-12 flex items-center justify-center rounded-r-lg border-r border-t border-b transition-all"
        style={{
          backgroundColor: "var(--white)",
          borderColor: "var(--border)",
          color: "var(--purple)",
          left: sidebarOpen ? "256px" : "0px",
          top: role === "admin" ? "calc(50% + 18px)" : "50%",
          transform: "translateY(-50%)",
        }}
      >
        {sidebarOpen ? "‹" : "›"}
      </button>

      {/* メイン：グラフ */}
      <div className={`flex-1 relative overflow-hidden ${role === "admin" ? "pt-9" : ""}`}>

        {/* 力士検索ボックス */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          <GraphSearch onSelect={handleSearch} />
          {hiddenWarning && (
            <div className="bg-amber-950/95 border border-amber-700/70 rounded-lg px-3 py-2 text-xs text-amber-200 shadow-xl backdrop-blur-sm flex items-center gap-2 max-w-64">
              <span className="shrink-0">⚠️</span>
              <span className="flex-1">
                <span className="font-semibold">{hiddenWarning.shikona}</span>
                は現在のフィルターに含まれていません
              </span>
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  className="text-amber-300 hover:text-amber-100 underline underline-offset-2 text-left whitespace-nowrap"
                  onClick={() => { setFilter((f) => ({ ...f, era: "全員" })); setHiddenWarning(null); }}
                >
                  全員表示
                </button>
                <button className="text-stone-500 hover:text-stone-300 text-left" onClick={() => setHiddenWarning(null)}>
                  ✕ 閉じる
                </button>
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-xs px-3 py-1 rounded-full shadow-sm" style={{ backgroundColor: "var(--white)", color: "var(--ink-muted)", border: "1px solid var(--border)" }}>
            更新中...
          </div>
        )}

        {/* ─ フローティングテーマパネル（ドラッグ可能・中央寄せ初期配置） ── */}
        {themePos && (
          <div className="absolute z-20 select-none" style={{ left: themePos.x, top: themePos.y }}>
            <div className="backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden w-[360px]" style={{ backgroundColor: "rgba(255,255,255,0.95)", border: "1px solid var(--purple)" }}>
              {/* ドラッグハンドル */}
              <div
                className="flex items-center justify-between px-4 py-2.5 cursor-grab active:cursor-grabbing"
                style={{ borderBottom: "1px solid var(--border)" }}
                onMouseDown={handleThemePanelDragStart}
              >
                <span className="text-xs font-bold tracking-widest select-none" style={{ color: "var(--purple)" }}>
                  ✦ 今の切り口
                </span>
                <div className="flex gap-[3px] opacity-40">
                  {[0,1,2,3,4,5].map(i => (
                    <span key={i} className="w-[3px] h-[3px] rounded-full bg-stone-400 block" />
                  ))}
                </div>
              </div>

              {/* テーマ本体 */}
              <div className="flex items-center gap-4 px-4 py-4">
                <span className="text-5xl leading-none flex-shrink-0">
                  {activeTheme.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold leading-snug" style={{ color: "var(--ink)" }}>
                    {activeTheme.label}
                  </p>
                  <p className="text-xs mt-1 leading-relaxed line-clamp-2" style={{ color: "var(--ink-muted)" }}>
                    {activeTheme.description}
                  </p>
                </div>
                <button
                  onClick={handleReshuffle}
                  title="別の切り口を見る"
                  className="shrink-0 transition-colors text-xl leading-none" style={{ color: "var(--border-dark)" }}
                >
                  🔀
                </button>
              </div>
            </div>
          </div>
        )}

        <SumoGraph
          graphData={visibleGraphData}
          onNodeClick={handleNodeClick}
          onBackgroundClick={() => setSelectedId(null)}
          selectedNodeId={selectedId}
        />

        <RikishiDetail
          rikishiId={selectedId}
          onClose={() => setSelectedId(null)}
          onNavigate={(id) => setSelectedId(id)}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}

// ─── 凡例 ──────────────────────────────────────────────────────────────────────
const LEGEND_ITEMS: { type: RelationType; weight: number }[] = [
  { type: "親子・兄弟",           weight: 5 },
  { type: "師弟（師匠）",         weight: 4 },
  { type: "親族",                 weight: 4 },
  { type: "師弟（弟子）",         weight: 3 },
  { type: "兄弟弟子",             weight: 3 },
  { type: "土俵の青春（同高校）", weight: 2 },
  { type: "土俵の青春（同大学）", weight: 2 },
  { type: "同期の絆（入門）",     weight: 2 },
  { type: "同郷",                 weight: 1 },
  { type: "一門の絆",             weight: 1 },
];

function Legend() {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)" }}>
      <p className="text-xs mb-2 font-medium" style={{ color: "var(--ink-muted)" }}>えにしの凡例</p>
      <div className="space-y-1.5">
        {LEGEND_ITEMS.map(({ type, weight }) => {
          const color = LINK_COLORS[type];
          const lineH = weight >= 4 ? "h-1" : weight === 3 ? "h-0.5" : "h-px";
          return (
            <div key={type} className="flex items-center gap-2">
              <div className={`w-7 ${lineH} rounded-full flex-shrink-0`} style={{ backgroundColor: color }} />
              <span className="text-xs" style={{ color: "var(--ink)" }}>{type}</span>
              <span className="text-xs ml-auto" style={{ color: "var(--border)" }}>{"●".repeat(weight)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <HomePageContent />
    </Suspense>
  );
}

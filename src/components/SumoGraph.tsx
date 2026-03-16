"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { GraphData, GraphNode, GraphLink } from "@/types";
import { LINK_COLORS } from "@/constants/linkColors";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-stone-500">
      グラフを準備中...
    </div>
  ),
});

// ─── 定数の再エクスポート（他コンポーネントが使えるように） ─────────────────
export { LINK_COLORS } from "@/constants/linkColors";

// 関係の濃さ → 線の太さ (px)
const LINK_WIDTH: Record<number, number> = {
  5: 4.0,
  4: 3.0,
  3: 1.8,
  2: 1.2,
  1: 0.7,
};

// 関係の濃さ → 不透明度（通常モード）
const LINK_OPACITY: Record<number, number> = {
  5: 1.0,
  4: 0.85,
  3: 0.55,
  2: 0.40,
  1: 0.25,
};

// 関係値 → フォーカス時の配置半径（グラフ座標）: 強い関係ほど近く
const FOCUS_RADIUS: Record<number, number> = {
  5:  70,
  4: 110,
  3: 160,
  2: 220,
  1: 300,
};

// リングごとに開始角度をずらす（同じ角度のノードが一直線に並ぶのを防ぐ）
const RING_PHASE: Record<number, number> = {
  5:                  0,            //   0°
  4: Math.PI / 5,                   //  36°
  3: (2 * Math.PI) / 5,             //  72°
  2: (3 * Math.PI) / 5,             // 108°
  1: (4 * Math.PI) / 5,             // 144°
};

// ─── 番付 → ノードサイズ ────────────────────────────────────────────────────
// 横綱〜序の口まで段階的に表現
const RANK_SIZE: Record<string, number> = {
  yokozuna:   18,
  ozeki:      14,
  sekiwake:   11,
  komusubi:    9,
  maegashira:  7,
  juryo:       5,
  makushita:   3.5,
  sandanme:    2.5,
  jonidan:     2,
  jonokuchi:   2,
};

const RANK_COLOR_ACTIVE: Record<string, string> = {
  yokozuna:   "#fbbf24",  // gold
  ozeki:      "#f97316",  // orange
  sekiwake:   "#a78bfa",  // purple
  komusubi:   "#60a5fa",  // blue
  maegashira: "#4ade80",  // green
  juryo:      "#34d399",  // teal
  makushita:  "#6ee7b7",  // light teal
  sandanme:   "#9ca3af",  // gray
  jonidan:    "#6b7280",  // dark gray
  jonokuchi:  "#4b5563",  // darker gray
};

// リングを表示する番付（上位4役のみ）
const RANK_HAS_RING = new Set(["yokozuna", "ozeki", "sekiwake", "komusubi"]);

const RANK_RING: Record<string, string> = {
  yokozuna:   "#fef08a",
  ozeki:      "#fed7aa",
  sekiwake:   "#ddd6fe",
  komusubi:   "#bfdbfe",
};

// 番付クラス → 日本語表示
const RANK_LABEL: Record<string, string> = {
  yokozuna:   "横綱",
  ozeki:      "大関",
  sekiwake:   "関脇",
  komusubi:   "小結",
  maegashira: "前頭",
  juryo:      "十両",
  makushita:  "幕下",
  sandanme:   "三段目",
  jonidan:    "序二段",
  jonokuchi:  "序の口",
};

const RETIRED_COLOR = "#52525b";

// ─── ヘルパー ────────────────────────────────────────────────────────────────
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getLinkEndId(endpoint: string | GraphNode): string {
  return typeof endpoint === "object" ? endpoint.id : endpoint;
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface Props {
  graphData: GraphData;
  onNodeClick: (node: GraphNode) => void;
  onBackgroundClick?: () => void;
  selectedNodeId: string | null;
}

export default function SumoGraph({ graphData, onNodeClick, onBackgroundClick, selectedNodeId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef        = useRef<any>(null); // react-force-graph-2d instance
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  // ノードホバー（ハイライト・ツールチップ用）
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  // エッジホバー
  // hoveredPair: hover中のノードペア（色判定に使用）
  const [hoveredPair, setHoveredPair]             = useState<{ srcId: string; tgtId: string } | null>(null);
  // hoveredDisplayLink: tooltip 表示用（同ペア内の最高 weight エッジ）
  const [hoveredDisplayLink, setHoveredDisplayLink] = useState<GraphLink | null>(null);
  const [mousePos, setMousePos]                   = useState({ x: 0, y: 0 });
  const imageCache        = useRef<Map<string, HTMLImageElement>>(new Map());
  // フォーカスレイアウト用: フォーカス前のノード位置を保存しておく
  const savedPositions    = useRef<Map<string, { x: number; y: number }>>(new Map());
  const prevSelectedIdRef = useRef<string | null>(null);
  // fgRef が未準備の場合にフォーカス効果をリトライするためのカウンター
  const [graphReadyRetry, setGraphReadyRetry] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ob = new ResizeObserver(() =>
      setDimensions({ width: el.clientWidth, height: el.clientHeight })
    );
    ob.observe(el);
    setDimensions({ width: el.clientWidth, height: el.clientHeight });
    return () => ob.disconnect();
  }, []);

  // ─── フォーカスモード：選択ノードの隣接ノードセットを計算 ───────────────
  const neighborSet = useMemo<Set<string> | null>(() => {
    if (!selectedNodeId) return null;
    const s = new Set<string>();
    for (const link of graphData.links) {
      const src = getLinkEndId(link.source);
      const tgt = getLinkEndId(link.target);
      if (src === selectedNodeId) s.add(tgt);
      if (tgt === selectedNodeId) s.add(src);
    }
    return s;
  }, [selectedNodeId, graphData.links]);

  // ─── フォーカス時ラジアルレイアウト（選択・解除を統合） ──────────────────
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) {
      // ForceGraph2D がまだ dynamic import 中 → 200ms 後にリトライ
      if (!selectedNodeId) return;
      const retryTimer = setTimeout(() => setGraphReadyRetry((n) => n + 1), 200);
      return () => clearTimeout(retryTimer);
    }

    const nodes = graphData.nodes as GraphNode[];
    const links = graphData.links as GraphLink[];

    // ── 選択解除 ─────────────────────────────────────────────────────────────
    if (!selectedNodeId) {
      if (savedPositions.current.size > 0) {
        // フォーカス↔デフォルト切り替え時はノード数が変わる（例: 31 → 150）
        // ノード数が一致する場合のみ元の位置に復元する
        if (savedPositions.current.size === nodes.length) {
          // 保存しておいた元の位置に fx/fy でピン止めして reheat
          for (const node of nodes) {
            const saved = savedPositions.current.get(node.id);
            if (saved) {
              node.fx = saved.x;
              node.fy = saved.y;
            }
          }
          fg.d3ReheatSimulation();

          // 少し後に fx/fy を解放して自然なシミュレーションに戻す
          const releaseTimer = setTimeout(() => {
            for (const node of nodes) {
              node.fx = null;
              node.fy = null;
            }
            fg.d3ReheatSimulation();
            savedPositions.current.clear();
          }, 700);

          fg.zoom(1.0, 600);
          prevSelectedIdRef.current = null;
          return () => clearTimeout(releaseTimer);
        } else {
          // ノード数が変わった（幕内+十両 ↔ フォーカス切り替え）
          // フォーカス時に設定した fx/fy ピン座標をクリアしてフォースシムに任せる
          // ※同じオブジェクト参照のノードに fx/fy が残っているため必ずクリアする
          savedPositions.current.clear();
          for (const node of nodes) {
            node.fx = null;
            node.fy = null;
          }
          fg.d3ReheatSimulation();
        }
      } else {
        // savedPositions が空のケースも念のため fx/fy をクリア
        for (const node of nodes) {
          node.fx = null;
          node.fy = null;
        }
        fg.d3ReheatSimulation();
      }

      fg.zoom(1.0, 600);
      prevSelectedIdRef.current = null;
      return;
    }

    // ── 選択時 ───────────────────────────────────────────────────────────────
    const selected = nodes.find((n) => n.id === selectedNodeId);
    if (!selected) return;

    // 初回選択（または別ノードへの切り替え後も savedPositions が空なら）だけ元位置を保存
    if (savedPositions.current.size === 0) {
      for (const node of nodes) {
        if (node.x !== undefined && node.y !== undefined) {
          savedPositions.current.set(node.id, { x: node.x, y: node.y });
        }
      }
    }

    // ノード切り替え時も「フォーカス前の元の位置」を中心にする
    const saved = savedPositions.current.get(selectedNodeId);
    const cx = saved?.x ?? selected.x ?? 0;
    const cy = saved?.y ?? selected.y ?? 0;

    // 選択ノードを中心に固定
    selected.fx = cx;
    selected.fy = cy;

    // 隣接ノードと最大 weight を収集
    const neighborWeights = new Map<string, number>();
    for (const link of links) {
      const src = getLinkEndId(link.source);
      const tgt = getLinkEndId(link.target);
      const w   = link.weight ?? 1;
      if (src === selectedNodeId) neighborWeights.set(tgt, Math.max(neighborWeights.get(tgt) ?? 0, w));
      if (tgt === selectedNodeId) neighborWeights.set(src, Math.max(neighborWeights.get(src) ?? 0, w));
    }

    // weight ごとにグループ化して同心円上に等間隔配置
    const byWeight: Record<number, string[]> = { 5: [], 4: [], 3: [], 2: [], 1: [] };
    for (const [nodeId, w] of neighborWeights) {
      (byWeight[w] ??= []).push(nodeId);
    }

    let maxRadius = 0;
    for (const [wStr, nodeIds] of Object.entries(byWeight)) {
      const w      = Number(wStr);
      const radius = FOCUS_RADIUS[w] ?? 300;
      const phase  = RING_PHASE[w] ?? 0; // リングごとに開始角度をずらす
      if (nodeIds.length > 0) maxRadius = Math.max(maxRadius, radius);
      const count  = nodeIds.length;
      nodeIds.forEach((nodeId, i) => {
        // phase を加算することで異なるリングのノードが同一直線上に並ばない
        const angle = phase + (2 * Math.PI * i) / count - Math.PI / 2;
        const node  = nodes.find((n) => n.id === nodeId);
        if (node) {
          node.fx = cx + radius * Math.cos(angle);
          node.fy = cy + radius * Math.sin(angle);
        }
      });
    }

    // 非隣接ノードは画面外（遠方）に散らす
    const offScreenDist = Math.max(dimensions.width, dimensions.height) * 1.2;
    const nonNeighbors  = nodes.filter(
      (n) => n.id !== selectedNodeId && !neighborWeights.has(n.id)
    );
    nonNeighbors.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / Math.max(nonNeighbors.length, 1);
      node.fx = cx + offScreenDist * Math.cos(angle);
      node.fy = cy + offScreenDist * Math.sin(angle);
    });

    fg.d3ReheatSimulation();

    // 全隣接ノードが収まるズームを動的に計算して中央寄せ
    const zoomTimer = setTimeout(() => {
      if (!fgRef.current) return;
      const targetZoom =
        maxRadius > 0
          ? Math.min(2.8, (Math.min(dimensions.width, dimensions.height) * 0.38) / maxRadius)
          : 2.5;
      fgRef.current.centerAt(cx, cy, 600);
      fgRef.current.zoom(targetZoom, 600);
    }, 120);

    prevSelectedIdRef.current = selectedNodeId;
    return () => clearTimeout(zoomTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId, graphData.nodes, graphData.links, dimensions, graphReadyRetry]);

  // ─── ノード描画 ────────────────────────────────────────────────────────────
  const paintNode = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n          = node as GraphNode;
      const rank       = n.rank ?? "maegashira";
      const isActive   = n.status === "active";
      const isSelected = n.id === selectedNodeId;
      const isHovered  = n.id === hoveredNodeId && !selectedNodeId;
      const isFocused  = !neighborSet || isSelected || neighborSet.has(n.id);
      const x          = n.x ?? 0;
      const y          = n.y ?? 0;

      // フォーカス外ノードはほぼ透明で描画
      if (!isFocused) {
        ctx.globalAlpha = 0.07;
      }

      const baseR     = RANK_SIZE[rank] ?? 6;
      // 選択ノードは少し大きく、ホバーノードも少し大きく
      const r         = baseR * (isActive ? 1 : 0.85) * (isSelected ? 1.25 : isHovered ? 1.15 : 1.0);
      const fillColor = isActive
        ? (RANK_COLOR_ACTIVE[rank] ?? RETIRED_COLOR)
        : RETIRED_COLOR;

      // ホバーノードのグロー（非フォーカスモード）
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(x, y, r + 11, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, r + 6, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fill();
      }

      // 選択ノードのグロー（パルス効果なし、静的グロー）
      if (isSelected) {
        // 外側ハロー
        ctx.beginPath();
        ctx.arc(x, y, r + 12, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(251,191,36,0.10)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, r + 7, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(251,191,36,0.20)";
        ctx.fill();
      }

      // 現役力士の番付リング（上位4役のみ）
      if (isActive && RANK_HAS_RING.has(rank)) {
        const ringColor = RANK_RING[rank] ?? "transparent";
        const ringR     = rank === "yokozuna" ? r + 4 : r + 2.5;
        const ringW     = rank === "yokozuna" ? 2.0  : 1.2;
        ctx.beginPath();
        ctx.arc(x, y, ringR, 0, 2 * Math.PI);
        ctx.strokeStyle = ringColor;
        ctx.lineWidth   = ringW;
        ctx.stroke();
      }

      // 横綱の二重リング
      if (isActive && rank === "yokozuna") {
        ctx.beginPath();
        ctx.arc(x, y, r + 7, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(251,191,36,0.28)";
        ctx.lineWidth   = 3;
        ctx.stroke();
      }

      // メインサークル（写真 or 色塗り）
      if (n.photo_url && isActive && globalScale >= 1.2) {
        let img = imageCache.current.get(n.photo_url);
        if (!img) {
          img = new Image();
          img.src = n.photo_url;
          img.onload = () => imageCache.current.set(n.photo_url!, img!);
          imageCache.current.set(n.photo_url, img);
        }
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.clip();
        if (img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
        } else {
          ctx.fillStyle = fillColor;
          ctx.fill();
        }
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = fillColor;
        ctx.fill();
      }

      // ボーダー
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.strokeStyle = isSelected
        ? "#fbbf24"
        : isHovered
          ? "rgba(255,255,255,0.80)"
          : isFocused
            ? (isActive ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.20)")
            : "rgba(255,255,255,0.10)";
      ctx.lineWidth = isSelected ? 2.5 : isHovered ? 1.8 : 0.8;
      ctx.stroke();

      // ラベル：
      //  - フォーカスモードではネイバー全員に常時表示
      //  - 通常モードではズームインまたは選択時のみ
      const showLabel =
        isSelected ||
        (neighborSet && neighborSet.has(n.id)) ||
        globalScale >= 1.5;

      if (showLabel) {
        const fontSize = Math.max(isSelected ? 13 / globalScale : 10 / globalScale, 3);
        ctx.font      = isSelected
          ? `bold ${fontSize}px sans-serif`
          : `${fontSize}px sans-serif`;
        ctx.textAlign    = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle    = isSelected
          ? "#fbbf24"
          : isActive ? "#f5f5f4" : "#a8a29e";
        ctx.fillText(n.name, x, y + r + 2.5 / globalScale);
      }

      // globalAlpha をリセット
      ctx.globalAlpha = 1.0;
    },
    [selectedNodeId, neighborSet, hoveredNodeId]
  );

  // ─── リンク色（フォーカスモード対応 + ホバー強調） ────────────────────────
  const linkColor = useCallback(
    (link: object) => {
      const l    = link as GraphLink;
      const src  = getLinkEndId(l.source);
      const tgt  = getLinkEndId(l.target);
      const w    = l.weight ?? 1;
      const base = LINK_COLORS[l.type] ?? "#6b7280";

      // ホバー中ペアかどうか（同ペア内の全エッジを全部光らせる）
      const isHoveredPair = hoveredPair !== null && (
        (src === hoveredPair.srcId && tgt === hoveredPair.tgtId) ||
        (src === hoveredPair.tgtId && tgt === hoveredPair.srcId)
      );
      if (isHoveredPair) {
        return base.startsWith("#") && base.length === 7
          ? hexToRgba(base, 0.95)
          : base;
      }

      // ノードホバー時：接続エッジを強調、それ以外を薄く（非フォーカスモードのみ）
      if (!neighborSet && hoveredNodeId) {
        const connected = src === hoveredNodeId || tgt === hoveredNodeId;
        const alpha = connected ? 0.80 : 0.04;
        return base.startsWith("#") && base.length === 7
          ? hexToRgba(base, alpha)
          : base;
      }

      if (neighborSet) {
        const srcFocused = src === selectedNodeId || neighborSet.has(src);
        const tgtFocused = tgt === selectedNodeId || neighborSet.has(tgt);

        // 両端がフォーカス外 → ほぼ不可視
        if (!srcFocused || !tgtFocused) return "rgba(60,60,60,0.05)";

        // 選択ノードに直結するエッジ → 鮮やかに（ホバー中は少しだけ抑制）
        if (src === selectedNodeId || tgt === selectedNodeId) {
          const alpha = hoveredPair ? 0.55 : 0.92;
          return base.startsWith("#") && base.length === 7
            ? hexToRgba(base, alpha)
            : base;
        }

        // ネイバー同士のエッジ
        const alpha = hoveredPair ? (LINK_OPACITY[w] ?? 0.25) * 0.5 : (LINK_OPACITY[w] ?? 0.25);
        return base.startsWith("#") && base.length === 7
          ? hexToRgba(base, alpha)
          : base;
      }

      // 通常モード: デフォルトは薄く、ホバー中は他をさらに薄く
      const defaultAlpha = hoveredPair ? 0.05 : 0.08;
      return base.startsWith("#") && base.length === 7
        ? hexToRgba(base, defaultAlpha)
        : base;
    },
    [selectedNodeId, neighborSet, hoveredPair, hoveredNodeId]
  );

  // ─── リンク太さ（選択ノード直結エッジを強調） ────────────────────────────
  const linkWidth = useCallback(
    (link: object) => {
      const l   = link as GraphLink;
      const src = getLinkEndId(l.source);
      const tgt = getLinkEndId(l.target);
      const w   = l.weight ?? 1;
      const base = LINK_WIDTH[w] ?? 0.7;

      if (neighborSet && (src === selectedNodeId || tgt === selectedNodeId)) {
        return base * 1.6; // 選択ノードへの接続を太く
      }
      return base;
    },
    [selectedNodeId, neighborSet]
  );

  // ─── パーティクル：フォーカスモードでは接続エッジのみ光らせる ───────────
  const particleWidth = useCallback(
    (link: object) => {
      const l   = link as GraphLink;
      const src = getLinkEndId(l.source);
      const tgt = getLinkEndId(l.target);
      const w   = l.weight ?? 1;

      if (neighborSet) {
        // フォーカスモード: 選択ノードに直結するエッジのみパーティクル
        if (src === selectedNodeId || tgt === selectedNodeId) return 2.5;
        return 0;
      }

      // 通常モード: weight >= 4 のみ
      return w >= 4 ? 2 : 0;
    },
    [selectedNodeId, neighborSet]
  );

  // ─── ホバーノード（リッチツールチップ用） ────────────────────────────────
  const hoveredNode = hoveredNodeId
    ? (graphData.nodes.find((n) => n.id === hoveredNodeId) ?? null)
    : null;

  // ─── ホバーリンクのノード名解決（tooltip 表示用の最高 weight エッジを使用） ──
  const hoveredSrcName = hoveredDisplayLink
    ? (typeof hoveredDisplayLink.source === "object"
        ? (hoveredDisplayLink.source as GraphNode).name
        : graphData.nodes.find((n) => n.id === (hoveredDisplayLink.source as string))?.name ?? "")
    : "";
  const hoveredTgtName = hoveredDisplayLink
    ? (typeof hoveredDisplayLink.target === "object"
        ? (hoveredDisplayLink.target as GraphNode).name
        : graphData.nodes.find((n) => n.id === (hoveredDisplayLink.target as string))?.name ?? "")
    : "";

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative" style={{ backgroundColor: "var(--washi)" }}
      onMouseMove={(e) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
    >
      {/* エッジホバー ツールチップ（同ペア内の最高 weight 関係を表示） */}
      {hoveredDisplayLink && (
        <div
          className="absolute pointer-events-none z-50 rounded-lg px-3 py-2 shadow-xl backdrop-blur-sm text-xs"
          style={{ backgroundColor: "rgba(255,255,255,0.97)", border: "1px solid var(--border)", color: "var(--ink)" }}
          style={{ left: mousePos.x + 14, top: mousePos.y - 42, maxWidth: 240 }}
        >
          <div className="flex items-center gap-2 font-semibold">
            <div
              className="w-4 h-0.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: LINK_COLORS[hoveredDisplayLink.type] ?? "#6b7280" }}
            />
            <span style={{ color: LINK_COLORS[hoveredDisplayLink.type] ?? "#d6d3d1" }}>
              {hoveredDisplayLink.type}
            </span>
          </div>
          {(hoveredSrcName || hoveredTgtName) && (
            <div className="mt-1 truncate" style={{ color: "var(--ink-muted)" }}>
              {hoveredSrcName} ↔ {hoveredTgtName}
            </div>
          )}
        </div>
      )}

      {/* ノードホバー リッチツールチップ */}
      {hoveredNode && !selectedNodeId && !hoveredDisplayLink && (
        <div
          className="absolute pointer-events-none z-50 rounded-xl px-3.5 py-2.5 shadow-2xl backdrop-blur-sm"
          style={{ backgroundColor: "rgba(255,255,255,0.97)", border: "1px solid var(--border)" }}
          style={{ left: mousePos.x + 16, top: mousePos.y - 60, minWidth: 140 }}
        >
          {/* 力士名 */}
          <div className="font-bold text-sm leading-tight" style={{ color: "var(--ink)", fontFamily: "'Noto Serif JP', serif" }}>{hoveredNode.name}</div>
          {/* 番付 */}
          <div className="flex items-center gap-1.5 mt-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: RANK_COLOR_ACTIVE[hoveredNode.rank ?? ""] ?? RETIRED_COLOR }}
            />
            <span className="text-xs" style={{ color: "var(--ink)" }}>
              {hoveredNode.rank_display
                ? `${RANK_LABEL[hoveredNode.rank ?? ""] ?? hoveredNode.rank ?? ""}（${hoveredNode.rank_display}）`
                : (RANK_LABEL[hoveredNode.rank ?? ""] ?? hoveredNode.rank ?? "")}
            </span>
          </div>
          {/* 部屋 */}
          {hoveredNode.heya && (
            <div className="text-xs mt-0.5 pl-4" style={{ color: "var(--ink-muted)" }}>{hoveredNode.heya}部屋</div>
          )}
        </div>
      )}

      {/* フォーカスモードバナー */}
      {selectedNodeId && neighborSet && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="text-xs px-3 py-1.5 rounded-full backdrop-blur-sm flex items-center gap-2" style={{ backgroundColor: "rgba(255,255,255,0.95)", border: "1px solid var(--purple)", color: "var(--purple)" }}>
            <span className="w-2 h-2 rounded-full animate-pulse inline-block" style={{ backgroundColor: "var(--purple)" }} />
            {/* node name をグラフデータから引く */}
            <span>
              {graphData.nodes.find((n) => n.id === selectedNodeId)?.name ?? ""}
              の人間関係 — {neighborSet.size}件のつながり
              {graphData.nodes.length > 1 && (
                <span className="text-stone-400 ml-1">
                  （絆の強い順 最大50人）
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData as any}
        width={dimensions.width}
        height={dimensions.height}
        nodeCanvasObject={paintNode as any}
        nodeCanvasObjectMode={() => "replace"}
        // クリックヒットエリアを視覚ノードより広めに確保（クリック漏れ防止）
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          const n = node as GraphNode;
          const rank = n.rank ?? "maegashira";
          const baseR = RANK_SIZE[rank] ?? 6;
          // ヒットエリアは描画半径の 2 倍（最小 12px）
          const hitR = Math.max(baseR * 2, 12);
          ctx.beginPath();
          ctx.arc(n.x ?? 0, n.y ?? 0, hitR, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkColor={linkColor as any}
        linkWidth={linkWidth as any}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={particleWidth as any}
        linkDirectionalParticleColor={linkColor as any}
        onNodeClick={(node: any) => onNodeClick(node as GraphNode)}
        onNodeHover={(node: any) => setHoveredNodeId(node ? (node as GraphNode).id : null)}
        onBackgroundClick={() => onBackgroundClick?.()}
        onLinkHover={(link: any) => {
          if (!link) {
            setHoveredPair(null);
            setHoveredDisplayLink(null);
            return;
          }
          const l     = link as GraphLink;
          const srcId = getLinkEndId(l.source);
          const tgtId = getLinkEndId(l.target);

          // 同一ノードペア間の全エッジを取得して weight 最大のものを tooltip に使う
          const best = graphData.links
            .filter((gl) => {
              const s = getLinkEndId(gl.source);
              const t = getLinkEndId(gl.target);
              return (s === srcId && t === tgtId) || (s === tgtId && t === srcId);
            })
            .reduce<GraphLink | null>(
              (max, gl) => (!max || (gl.weight ?? 0) > (max.weight ?? 0) ? gl : max),
              null
            );

          setHoveredPair({ srcId, tgtId });
          setHoveredDisplayLink(best ?? l);
        }}
        nodeLabel={() => ""}

        linkLabel={() => ""}
        backgroundColor="#F5F0EB"
        cooldownTicks={60}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />
    </div>
  );
}

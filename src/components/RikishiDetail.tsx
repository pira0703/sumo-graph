"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Rikishi } from "@/types";
import type { ConnectionItem } from "@/app/api/rikishi/[id]/connections/route";
import { LINK_COLORS } from "@/constants/linkColors";

interface Props {
  canEdit: boolean;
  rikishiId: string | null;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

const RANK_LABEL: Record<string, string> = {
  yokozuna: "横綱", ozeki: "大関", sekiwake: "関脇",
  komusubi: "小結", maegashira: "前頭", juryo: "十両",
  makushita: "幕下", sandanme: "三段目", jonidan: "序二段",
  jonokuchi: "序ノ口", 引退: "引退",
};

const RANK_COLOR: Record<string, string> = {
  yokozuna: "#fbbf24", ozeki: "#f97316", sekiwake: "#a78bfa",
  komusubi: "#60a5fa", maegashira: "#34d399",
};

/** rank_class → 番付ページの div クエリパラメータ */
const RANK_TO_DIV: Record<string, string> = {
  yokozuna: "makuuchi", ozeki: "makuuchi", sekiwake: "makuuchi",
  komusubi: "makuuchi", maegashira: "makuuchi",
  juryo: "juryo", makushita: "makushita", sandanme: "sandanme",
  jonidan: "jonidan", jonokuchi: "jonokuchi",
};

/** 番付を日本語形式に変換（例: rank_class=maegashira, rank_number=14, rank_side=west → "西前頭14枚目"） */
function formatBanzukeDisplay(
  rankClass: string,
  rankNumber: number | null,
  rankSide: string | null
): string {
  const sideLabel = rankSide === "east" ? "東" : rankSide === "west" ? "西" : "";
  const classLabel: Record<string, string> = {
    yokozuna: "横綱", ozeki: "大関", sekiwake: "関脇",
    komusubi: "小結", maegashira: "前頭", juryo: "十両",
    makushita: "幕下", sandanme: "三段目", jonidan: "序二段", jonokuchi: "序ノ口",
  };
  const label = classLabel[rankClass] ?? rankClass;
  // 上位4役（横綱〜小結）は枚数なし
  const noNumber = ["yokozuna", "ozeki", "sekiwake", "komusubi"].includes(rankClass);
  if (noNumber || !rankNumber) return `${sideLabel}${label}`;
  return `${sideLabel}${label}${rankNumber}枚目`;
}

/**
 * 学歴タグ判定
 */
function getEduInfo(r: {
  high_school?: string | null;
  university?: string | null;
}): { tag: "中卒" | "高卒" | "大卒"; highSchool: string | null; university: string | null } {
  const hs  = r.high_school ?? null;
  const uni = r.university  ?? null;

  let tag: "中卒" | "高卒" | "大卒" = "中卒";
  let resolvedUni  = uni;
  let resolvedHs   = hs;

  if (uni) {
    tag = "大卒";
  } else if (hs) {
    tag = "高卒";
  }

  return { tag, highSchool: resolvedHs, university: resolvedUni };
}

const EDU_COLOR: Record<string, string> = {
  大卒: "#60a5fa",
  高卒: "#34d399",
  中卒: "#a8a29e",
};

// ─── 番付変遷エントリ型 ───────────────────────────────────────────────────────
interface BanzukeHistoryEntry {
  id:           string;
  rikishi_id:   string;
  basho:        string;
  rank_class:   string;
  rank_number:  number | null;
  rank_side:    string | null;
  rank_display: string | null;
}

// 番付格の数値化（チャート用）
const RANK_LEVEL: Record<string, number> = {
  yokozuna: 1, ozeki: 2, sekiwake: 3, komusubi: 4,
  maegashira: 5, juryo: 6, makushita: 7,
  sandanme: 8, jonidan: 9, jonokuchi: 10,
};

/** 番付を連続値に変換（小さいほど上位） */
function rankToValue(entry: BanzukeHistoryEntry): number {
  const base = (RANK_LEVEL[entry.rank_class] ?? 11) * 100;
  const n    = entry.rank_number ?? 0;
  const side = entry.rank_side === "east" ? 0 : 1;
  return base + n * 2 + side;
}

// ─── 番付変遷タブ ─────────────────────────────────────────────────────────────

function BanzukeHistoryTab({ rikishiId, bashoId }: { rikishiId: string; bashoId: string | null }) {
  const [history, setHistory] = useState<BanzukeHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/rikishi/${rikishiId}/banzuke?all=1`)
      .then(r => r.json())
      .then(d => setHistory(d.history ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [rikishiId]);

  if (loading) return <div className="text-center py-8 text-stone-500 text-sm">読み込み中...</div>;
  if (history.length === 0) return (
    <div className="text-center py-8 space-y-1">
      <div className="text-stone-400 text-sm font-medium">関取未経験</div>
      <div className="text-stone-600 text-xs">幕内・十両の番付データがありません</div>
    </div>
  );

  // ミニチャート: SVG sparkline
  // 最古→最新の順、Y軸: rankToValue（低いほど上位なので反転）
  const sorted = [...history].sort((a, b) => a.basho.localeCompare(b.basho));
  const values = sorted.map(rankToValue);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range  = Math.max(maxVal - minVal, 1);

  const W = 240, H = 60, PAD = 4;
  const points = sorted.map((_, i) => {
    const x = PAD + (i / Math.max(sorted.length - 1, 1)) * (W - PAD * 2);
    // 上位ほど上（小さいY）
    const y = PAD + ((values[i] - minVal) / range) * (H - PAD * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="space-y-3">
      {/* Sparkline */}
      <div className="bg-stone-900 rounded-lg p-3">
        <p className="text-stone-500 text-xs mb-2">番付推移（上＝上位）</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
          <polyline
            points={points}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* 最高位マーカー */}
          {(() => {
            const bestIdx = values.indexOf(minVal);
            const pt = points.split(" ")[bestIdx]?.split(",");
            if (!pt) return null;
            return <circle cx={pt[0]} cy={pt[1]} r="3" fill="#fbbf24" />;
          })()}
        </svg>
        <div className="flex justify-between text-stone-600 text-xs mt-1">
          <span>{sorted[0]?.basho}</span>
          <span>{sorted[sorted.length - 1]?.basho}</span>
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-stone-900 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-stone-800 text-stone-500">
              <th className="text-left px-3 py-2">場所</th>
              <th className="text-center px-2 py-2">番付</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(e => {
              const isCurrent = e.basho === bashoId;
              const divParam  = RANK_TO_DIV[e.rank_class] ?? "makuuchi";
              return (
                <tr
                  key={e.id}
                  className={`border-b border-stone-800/50
                    ${isCurrent ? "bg-amber-950/30" : "hover:bg-stone-800/50"}`}
                >
                  <td className="px-3 py-1.5">
                    <Link
                      href={`/banzuke/${e.basho}?div=${divParam}`}
                      className="text-stone-300 hover:text-amber-400 transition-colors"
                    >
                      {e.basho}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`font-medium ${isCurrent ? "text-amber-400" : "text-stone-200"}`}>
                      {formatBanzukeDisplay(e.rank_class, e.rank_number, e.rank_side)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RikishiDetail({ rikishiId, onClose, onNavigate, canEdit }: Props) {
  const [rikishi, setRikishi] = useState<Rikishi | null>(null);
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"profile" | "banzuke">("profile");

  // タブをリセット（別力士を選んだとき）
  useEffect(() => { setTab("profile"); }, [rikishiId]);

  useEffect(() => {
    if (!rikishiId) { setRikishi(null); setConnections([]); return; }
    setLoading(true);

    Promise.all([
      fetch(`/api/rikishi/${rikishiId}`).then((r) => r.json()),
      fetch(`/api/rikishi/${rikishiId}/connections`).then((r) => r.json()),
    ])
      .then(([rikishiData, connData]) => {
        setRikishi(rikishiData.rikishi ?? null);
        setConnections(connData.connections ?? []);
      })
      .finally(() => setLoading(false));
  }, [rikishiId]);

  if (!rikishiId) return null;

  const isActive = rikishi?.status !== "retired";
  // 現役: current_banzuke の rank_class、引退: highest_rank
  const currentBanzuke = (rikishi as (typeof rikishi & { current_banzuke?: { basho: string; rank_class: string; rank_number: number | null; rank_side: string | null; rank_display: string | null } | null }) | null)?.current_banzuke ?? null;
  const rank     = isActive ? (currentBanzuke?.rank_class ?? rikishi?.highest_rank ?? "") : (rikishi?.highest_rank ?? "");
  const edu      = getEduInfo({
    high_school: (rikishi as unknown as { high_school?: string | null } | null)?.high_school,
    university:  (rikishi as unknown as { university?: string | null }  | null)?.university,
  });

  return (
    <div
      className="fixed bottom-0 left-0 right-0 h-[75vh] rounded-t-2xl border-t z-30 sm:static sm:h-full sm:w-80 sm:flex-shrink-0 sm:rounded-none sm:border-t-0 sm:border-l sm:z-auto overflow-y-auto flex flex-col"
      style={{ backgroundColor: "var(--white)", borderColor: "var(--border)" }}
    >
      {/* ヘッダー */}
      <div className="sticky top-0 z-10" style={{ backgroundColor: "var(--white)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-4 pt-3 pb-0">
          <span className="font-bold text-sm" style={{ color: "var(--purple)" }}>力士プロフィール</span>
          <div className="flex items-center gap-2">
            {rikishiId && (
              canEdit ? (
                <Link
                  href={`/rikishi/${rikishiId}/edit`}
                  className="text-xs px-2 py-1 rounded transition-colors"
                  style={{ color: "var(--ink-muted)", border: "1px solid var(--border)" }}
                >
                  ✏️ 編集
                </Link>
              ) : (
                <span
                  className="text-xs px-2 py-1 rounded cursor-not-allowed select-none"
                  style={{ color: "var(--border)", border: "1px solid var(--border)" }}
                  title="editor 以上で利用可能"
                >
                  🔒 編集
                </span>
              )
            )}
            <button onClick={onClose} className="text-xl leading-none" style={{ color: "var(--ink-muted)" }}>×</button>
          </div>
        </div>
        {/* タブ */}
        <div className="flex px-4 mt-2">
          {([["profile", "プロフィール"], ["banzuke", "番付変遷"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="px-3 py-1.5 text-xs font-medium border-b-2 transition-colors"
              style={{
                borderBottomColor: tab === key ? "var(--purple)" : "transparent",
                color: tab === key ? "var(--purple)" : "var(--ink-muted)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--ink-muted)" }}>読み込み中...</div>
      )}

      {rikishi && (
        <div className="p-4 space-y-4">
          {/* 番付変遷タブ */}
          {tab === "banzuke" && (
            <BanzukeHistoryTab
              rikishiId={rikishi.id}
              bashoId={currentBanzuke?.basho ?? null}
            />
          )}

          {/* プロフィールタブ */}
          {tab !== "banzuke" && (<>
          {/* 顔写真 + 名前 */}
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0" style={{ backgroundColor: "var(--purple-pale)" }}>
              {rikishi.photo_url ? (
                <Image
                  src={rikishi.photo_url}
                  alt={rikishi.shikona}
                  width={64} height={64}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">🏆</div>
              )}
            </div>
            <div className="space-y-1">
              <h2 className="font-bold text-lg leading-tight" style={{ color: "var(--ink)", fontFamily: "'Noto Serif JP', serif" }}>{rikishi.shikona}</h2>
              {rikishi.yomigana && (
                <p className="text-xs" style={{ color: "var(--ink-muted)" }}>{rikishi.yomigana}</p>
              )}
              <div className="flex flex-wrap gap-1">
                {rank && (() => {
                  const label = isActive && currentBanzuke
                    ? formatBanzukeDisplay(
                        currentBanzuke.rank_class,
                        currentBanzuke.rank_number,
                        currentBanzuke.rank_side
                      )
                    : (RANK_LABEL[rank] ?? rank);
                  const divParam = RANK_TO_DIV[rank];
                  const bashoId  = isActive && currentBanzuke ? currentBanzuke.basho : null;

                  if (bashoId && divParam) {
                    return (
                      <Link
                        href={`/banzuke/${bashoId}?div=${divParam}`}
                        className="text-xs px-2 py-0.5 rounded-full font-medium
                          hover:opacity-80 hover:ring-1 hover:ring-white/40 transition-opacity"
                        style={{ backgroundColor: RANK_COLOR[rank] ?? "#6b7280", color: "black" }}
                        title="番付を見る"
                      >
                        {label}
                      </Link>
                    );
                  }
                  return (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: RANK_COLOR[rank] ?? "#6b7280", color: "black" }}
                    >
                      {label}
                    </span>
                  );
                })()}
                {!isActive && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "var(--border)", color: "var(--ink)" }}>
                    引退
                  </span>
                )}
                {/* 学歴タグ */}
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: EDU_COLOR[edu.tag], color: "black" }}
                >
                  {edu.tag}
                </span>
              </div>
            </div>
          </div>

          {/* えにし（エピソード）— コアバリューなので最上部に配置 */}
          {rikishi.episodes && (
            <div className="rounded-lg p-3" style={{ backgroundColor: "var(--purple-pale)", borderLeft: "3px solid var(--purple)" }}>
              <p className="text-xs font-bold mb-1.5" style={{ color: "var(--purple)", fontFamily: "'Noto Serif JP', serif" }}>えにし</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--ink)" }}>{rikishi.episodes}</p>
            </div>
          )}

          {/* 基本情報 */}
          <div className="rounded-lg p-3 space-y-1.5 text-xs" style={{ backgroundColor: "var(--washi)", border: "1px solid var(--border)" }}>
            {(rikishi.heya as { name: string } | null)?.name && (
              <Row label="部屋" value={(rikishi.heya as { name: string }).name + "部屋"} />
            )}
            {rikishi.born_place && <Row label="出身" value={rikishi.born_place} />}
            {rikishi.birth_date && <Row label="生年月日" value={rikishi.birth_date} />}
            {rikishi.active_from_basho && (
              <Row
                label="初土俵"
                value={rikishi.active_from_basho}
              />
            )}
            {/* 学歴（高校・大学を個別表示） */}
            {edu.highSchool && (
              <Row label="出身高校" value={edu.highSchool} />
            )}
            {edu.university && (
              <Row label="出身大学" value={edu.university} />
            )}
          </div>

          {/* ─── つながりトップ10 ─── */}
          {connections.length > 0 && (
            <div>
              <p className="text-xs mb-2 font-medium" style={{ color: "var(--ink-muted)" }}>
                えにしトップ{Math.min(connections.length, 10)}
              </p>
              <div className="space-y-1.5">
                {connections.map((conn) => {
                  const lineColor = LINK_COLORS[conn.relation_type] ?? "#6b7280";
                  return (
                    <button
                      key={conn.id}
                      onClick={() => onNavigate(conn.id)}
                      className="w-full flex items-center gap-2 rounded-lg p-2 text-left transition-colors group"
                      style={{ backgroundColor: "var(--washi)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = "var(--purple-pale)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = "var(--washi)"}
                    >
                      {/* 関係タイプのカラーバー */}
                      <div
                        className="w-1 self-stretch rounded-full flex-shrink-0"
                        style={{ backgroundColor: lineColor }}
                      />
                      {/* 顔写真 */}
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 overflow-hidden" style={{ backgroundColor: "var(--purple-pale)" }}>
                        {conn.photo_url ? (
                          <Image
                            src={conn.photo_url}
                            alt={conn.shikona}
                            width={32} height={32}
                            className="rounded-full object-cover"
                          />
                        ) : "🏆"}
                      </div>
                      {/* 名前・関係 */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate transition-colors" style={{ color: "var(--ink)" }}>
                          {conn.shikona}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span
                            className="text-xs font-medium"
                            style={{ color: lineColor }}
                          >
                            {conn.relation_type}
                          </span>
                          {conn.heya && (
                            <span className="text-xs truncate" style={{ color: "var(--ink-muted)" }}>
                              · {conn.heya}
                            </span>
                          )}
                        </div>
                        {conn.description && (
                          <p className="text-xs truncate mt-0.5" style={{ color: "var(--ink-muted)" }}>{conn.description}</p>
                        )}
                      </div>
                      {/* weight バッジ */}
                      <div className="flex-shrink-0">
                        <span className="text-xs" style={{ color: "var(--border)" }}>{"●".repeat(Math.min(conn.weight, 5))}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* プロフィールタブ終了 */}
          </>)}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  // eslint-disable-next-line
  return (
    <div className="flex gap-2">
      <span className="w-16 flex-shrink-0" style={{ color: "var(--ink-muted)" }}>{label}</span>
      <span style={{ color: "var(--ink)" }}>{value}</span>
    </div>
  );
}

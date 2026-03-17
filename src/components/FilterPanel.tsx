"use client";

import { useEffect, useRef, useState } from "react";
import type {
  FilterState, RelationType, EducationFilter, AgeGroupFilter, RankDivision,
  CareerTrend, CareerStage, PromotionSpeed,
} from "@/types";
import {
  ICHIMON_LIST, RANK_DIVISION_LIST,
  CAREER_TREND_LIST, CAREER_STAGE_LIST, PROMOTION_SPEED_LIST,
  CAREER_TREND_LABELS, CAREER_STAGE_LABELS, PROMOTION_SPEED_LABELS,
} from "@/types";
import { REGION_LABELS } from "@/constants/regions";
import { AGE_GROUP_LABELS } from "@/constants/regions";

// ─── 関係種別 ──────────────────────────────────────────────────────────────────
const RELATION_TYPES: RelationType[] = [
  "師弟（師匠）", "兄弟弟子",
  "同郷", "土俵の青春（同高校）", "土俵の青春（同大学）",
  "同期の絆（入門）", "一門の絆",
];

const RELATION_COLORS: Record<RelationType, string> = {
  "師弟（師匠）":         "#ef4444",
  兄弟弟子:               "#eab308",
  同郷:                   "#3b82f6",
  "土俵の青春（同高校）": "#a855f7",
  "土俵の青春（同大学）": "#8b5cf6",
  "同期の絆（入門）":     "#06b6d4",
  "一門の絆":             "#14b8a6",
};

const EDUCATION_LABELS: EducationFilter[] = ["中卒", "高卒", "大卒"];

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  filter: FilterState;
  onChange: (f: FilterState) => void;
  heyaOptions: { id: string; name: string }[];
}

// ─── 部屋マルチセレクト ────────────────────────────────────────────────────────
function HeyaMultiSelect({
  options,
  selected,
  onChange,
}: {
  options: { id: string; name: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  const label =
    selected.length === 0
      ? "すべての部屋"
      : selected.length === 1
      ? (options.find((o) => o.id === selected[0])?.name ?? selected[0])
      : `${selected.length}部屋選択中`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none text-left flex justify-between items-center transition-colors"
        style={{ backgroundColor: "var(--washi)", border: "1px solid var(--border)", color: "var(--ink)" }}
      >
        <span style={{ color: selected.length > 0 ? "var(--purple)" : "var(--ink-muted)" }}>{label}</span>
        <span className="text-[10px] ml-1" style={{ color: "var(--ink-muted)" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg z-50 max-h-52 overflow-y-auto shadow-xl"
          style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)" }}>
          <button
            className="w-full px-3 py-2 text-xs text-left transition-colors"
            style={{ color: "var(--ink-muted)", borderBottom: "1px solid var(--border)" }}
            onClick={() => onChange([])}
          >
            すべての部屋（解除）
          </button>
          {options.map((opt) => (
            <label
              key={opt.id}
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs transition-colors"
              style={{ color: "var(--ink)" }}
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.id)}
                onChange={() => toggle(opt.id)}
                className="shrink-0"
                style={{ accentColor: "var(--purple)" }}
              />
              {opt.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── マルチトグルボタン（汎用） ────────────────────────────────────────────────
function MultiToggle<T extends string>({
  options,
  selected,
  onChange,
  colorMap,
  labelMap,
  wrap = true,
}: {
  options: readonly T[];
  selected: T[];
  onChange: (v: T[]) => void;
  colorMap?: Record<string, string>;
  labelMap?: Record<string, string>;
  wrap?: boolean;
}) {
  const toggle = (v: T) =>
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);

  const isAll = selected.length === 0;

  return (
    <div className={`flex gap-1.5 ${wrap ? "flex-wrap" : ""}`}>
      <button
        onClick={() => onChange([])}
        className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
        style={isAll
          ? { backgroundColor: "var(--purple)", color: "white" }
          : { backgroundColor: "var(--washi)", color: "var(--ink-muted)", border: "1px solid var(--border)" }
        }
      >
        すべて
      </button>
      {options.map((opt) => {
        const active = selected.includes(opt);
        const color  = colorMap?.[opt];
        const label  = labelMap?.[opt] ?? opt;
        return (
          <button
            key={opt}
            onClick={() => toggle(opt)}
            className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
            style={
              color
                ? {
                    backgroundColor: active ? color : "var(--washi)",
                    color: active ? "white" : "var(--ink-muted)",
                    border: active ? "none" : "1px solid var(--border)",
                    opacity: !isAll && !active ? 0.45 : 1,
                  }
                : {
                    backgroundColor: active
                      ? "var(--purple)"
                      : !isAll
                      ? "var(--washi)"
                      : "var(--washi)",
                    color: active ? "white" : !isAll ? "var(--border-dark)" : "var(--ink-muted)",
                    border: active ? "none" : "1px solid var(--border)",
                    opacity: !isAll && !active ? 0.6 : 1,
                  }
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── セクションヘッダー ────────────────────────────────────────────────────────
function SectionHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <span className="text-sm">{icon}</span>
      <span className="text-xs font-semibold tracking-wide" style={{ color: "var(--purple)" }}>{label}</span>
      <div className="flex-1 h-px ml-1" style={{ backgroundColor: "var(--border)" }} />
    </div>
  );
}

// ─── メイン FilterPanel ────────────────────────────────────────────────────────
export default function FilterPanel({
  filter,
  onChange,
  heyaOptions,
}: Props) {
  // ── エッジ種別トグル ──
  const toggleRelationType = (rt: RelationType) => {
    const current = filter.relation_types;
    onChange({
      ...filter,
      relation_types: current.includes(rt)
        ? current.filter((t) => t !== rt)
        : [...current, rt],
    });
  };
  const isAllRelations = filter.relation_types.length === 0;

  // ── 一門トグル ──
  const toggleIchimon = (name: string) => {
    const current = filter.ichimons;
    onChange({
      ...filter,
      ichimons: current.includes(name)
        ? current.filter((i) => i !== name)
        : [...current, name],
    });
  };

  return (
    <div className="rounded-xl p-4 text-sm space-y-5" style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink)" }}>

      {/* ══ ノードの絞り込み ══════════════════════════════════════════════════ */}
      <div>
        <SectionHeader icon="🔵" label="力士の絞り込み" />
        <div className="space-y-3">

          {/* 時代 */}
          <div>
            <p className="text-xs mb-1.5" style={{ color: "var(--ink-muted)" }}>時代</p>
            <div className="flex gap-1.5">
              {(["全員", "現役", "引退"] as const).map((e) => (
                <button
                  key={e}
                  onClick={() => onChange({ ...filter, era: e })}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                  style={filter.era === e
                    ? { backgroundColor: "var(--purple)", color: "white" }
                    : { backgroundColor: "var(--washi)", color: "var(--ink-muted)", border: "1px solid var(--border)" }
                  }
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* 番付 */}
          <div>
            <p className="text-xs mb-1.5" style={{ color: "var(--ink-muted)" }}>番付</p>
            <MultiToggle<RankDivision>
              options={RANK_DIVISION_LIST}
              selected={filter.rankDivisions}
              onChange={(rankDivisions) => onChange({ ...filter, rankDivisions })}
            />
          </div>

          {/* 部屋 */}
          <div>
            <p className="text-xs mb-1.5" style={{ color: "var(--ink-muted)" }}>部屋</p>
            <HeyaMultiSelect
              options={heyaOptions}
              selected={filter.heyas}
              onChange={(heyas) => onChange({ ...filter, heyas })}
            />
          </div>

          {/* 一門 */}
          <div>
            <p className="text-xs mb-1.5" style={{ color: "var(--ink-muted)" }}>一門</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => onChange({ ...filter, ichimons: [] })}
                className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                style={filter.ichimons.length === 0
                  ? { backgroundColor: "var(--purple)", color: "white" }
                  : { backgroundColor: "var(--washi)", color: "var(--ink-muted)", border: "1px solid var(--border)" }
                }
              >
                すべて
              </button>
              {ICHIMON_LIST.map((name) => {
                const active = filter.ichimons.includes(name);
                // 一門名から「一門」を除いて短縮表示
                const short = name.replace("一門", "");
                return (
                  <button
                    key={name}
                    onClick={() => toggleIchimon(name)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                    style={active
                      ? { backgroundColor: "var(--purple)", color: "white" }
                      : filter.ichimons.length > 0
                      ? { backgroundColor: "var(--washi)", color: "var(--border-dark)", border: "1px solid var(--border)", opacity: 0.5 }
                      : { backgroundColor: "var(--washi)", color: "var(--ink-muted)", border: "1px solid var(--border)" }
                    }
                  >
                    {short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 出身地域 */}
          <div>
            <p className="text-xs mb-1.5" style={{ color: "var(--ink-muted)" }}>出身地域</p>
            <MultiToggle<string>
              options={REGION_LABELS}
              selected={filter.regions}
              onChange={(regions) => onChange({ ...filter, regions })}
            />
          </div>

          {/* 学歴 */}
          <div>
            <p className="text-xs mb-1.5" style={{ color: "var(--ink-muted)" }}>学歴</p>
            <MultiToggle<EducationFilter>
              options={EDUCATION_LABELS}
              selected={filter.educations}
              onChange={(educations) => onChange({ ...filter, educations })}
            />
          </div>

          {/* 年齢 */}
          <div>
            <p className="text-xs mb-1.5" style={{ color: "var(--ink-muted)" }}>年齢</p>
            <MultiToggle<AgeGroupFilter>
              options={AGE_GROUP_LABELS}
              selected={filter.ageGroups}
              onChange={(ageGroups) => onChange({ ...filter, ageGroups })}
            />
          </div>

          {/* キャリアトレンド */}
          <div>
            <p className="text-xs mb-1.5" style={{ color: "var(--ink-muted)" }}>キャリアトレンド</p>
            <MultiToggle<CareerTrend>
              options={CAREER_TREND_LIST}
              selected={filter.careerTrends}
              onChange={(careerTrends) => onChange({ ...filter, careerTrends })}
              labelMap={CAREER_TREND_LABELS}
            />
          </div>

          {/* キャリアステージ */}
          <div>
            <p className="text-xs mb-1.5" style={{ color: "var(--ink-muted)" }}>キャリアステージ</p>
            <MultiToggle<CareerStage>
              options={CAREER_STAGE_LIST}
              selected={filter.careerStages}
              onChange={(careerStages) => onChange({ ...filter, careerStages })}
              labelMap={CAREER_STAGE_LABELS}
            />
          </div>

          {/* 昇進スピード */}
          <div>
            <p className="text-xs mb-1.5" style={{ color: "var(--ink-muted)" }}>昇進スピード</p>
            <MultiToggle<PromotionSpeed>
              options={PROMOTION_SPEED_LIST}
              selected={filter.promotionSpeeds}
              onChange={(promotionSpeeds) => onChange({ ...filter, promotionSpeeds })}
              labelMap={PROMOTION_SPEED_LABELS}
            />
          </div>

        </div>
      </div>

      {/* セパレーター */}
      <div className="border-t" style={{ borderColor: "var(--border)" }} />

      {/* ══ エッジの表示条件 ══════════════════════════════════════════════════ */}
      <div>
        <SectionHeader icon="🔗" label="えにしの種類" />

        {/* 関係の種類 */}
        <div>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => onChange({ ...filter, relation_types: [] })}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
              style={isAllRelations
                ? { backgroundColor: "var(--purple)", color: "white" }
                : { backgroundColor: "var(--washi)", color: "var(--ink-muted)", border: "1px solid var(--border)" }
              }
            >
              すべて
            </button>
            {RELATION_TYPES.map((rt) => {
              const active = filter.relation_types.includes(rt);
              return (
                <button
                  key={rt}
                  onClick={() => toggleRelationType(rt)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                  style={{
                    backgroundColor: active ? RELATION_COLORS[rt] : "var(--washi)",
                    color: active ? "white" : "var(--ink-muted)",
                    border: active ? "none" : "1px solid var(--border)",
                    opacity: !isAllRelations && !active ? 0.45 : 1,
                  }}
                >
                  {rt}
                </button>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}

export { RELATION_COLORS };

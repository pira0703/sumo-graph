"use client";

import { useCallback, useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import { LINK_COLORS } from "@/constants/linkColors";
import {
  ICHIMON_LIST, RANK_DIVISION_LIST,
  CAREER_TREND_LIST, CAREER_STAGE_LIST, PROMOTION_SPEED_LIST,
  CAREER_TREND_LABELS, CAREER_STAGE_LABELS, PROMOTION_SPEED_LABELS,
} from "@/types";
import type {
  RelationType, EducationFilter, AgeGroupFilter, RankDivision,
  CareerTrend, CareerStage, PromotionSpeed,
} from "@/types";

// ─── 定数 ────────────────────────────────────────────────────────────────────
const RELATION_TYPES: RelationType[] = [
  "師弟（師匠）", "師弟（弟子）", "親子・兄弟", "兄弟弟子",
  "同郷", "土俵の青春（同高校）", "土俵の青春（同大学）",
  "同期の絆（入門）", "親族", "一門の絆",
];
const REGIONS = [
  "北海道・東北", "関東・甲信越", "中部", "近畿",
  "中国・四国", "九州・沖縄", "国外",
];
const EDUCATIONS: EducationFilter[] = ["中卒", "高卒", "大卒"];
const AGE_GROUPS: AgeGroupFilter[] = ["10代", "20代前半", "20代後半", "30代前半", "35歳以上"];
const ERA_OPTIONS = ["現役", "引退", "全員"] as const;

// ─── 型 ──────────────────────────────────────────────────────────────────────
interface FilterConfig {
  era?:             "現役" | "引退" | "全員";
  rankDivisions?:   RankDivision[];
  ichimons?:        string[];
  relation_types?:  RelationType[];
  regions?:         string[];
  educations?:      EducationFilter[];
  ageGroups?:       AgeGroupFilter[];
  careerTrends?:    CareerTrend[];
  careerStages?:    CareerStage[];
  promotionSpeeds?: PromotionSpeed[];
}

interface ThemeRow {
  id:             string;
  emoji:          string;
  label:          string;
  description:    string;
  filter_config:  FilterConfig;
  show_all_ranks: boolean;
  sort_order:     number;
  created_at:     string;
  updated_at:     string;
}

const EMPTY_FORM: Omit<ThemeRow, "id" | "created_at" | "updated_at"> = {
  emoji:          "🏆",
  label:          "",
  description:    "",
  filter_config:  {
    era: "現役", rankDivisions: ["幕内", "十両"],
    ichimons: [], relation_types: [], regions: [], educations: [], ageGroups: [],
    careerTrends: [], careerStages: [], promotionSpeeds: [],
  },
  show_all_ranks: false,
  sort_order:     0,
};

// ─── サブコンポーネント：多選択チェックボックス群 ─────────────────────────
function MultiCheck<T extends string>({
  label, options, selected, onChange, colorMap, labelMap,
}: {
  label: string;
  options: readonly T[];
  selected: T[];
  onChange: (v: T[]) => void;
  colorMap?: Record<string, string>;
  labelMap?: Record<string, string>;
}) {
  const toggle = (v: T) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  return (
    <div>
      <p className="text-stone-400 text-xs font-medium mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = selected.includes(opt);
          const color  = colorMap?.[opt];
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`px-2 py-0.5 rounded text-xs border transition-colors
                ${active
                  ? "border-amber-500 bg-amber-500/20 text-amber-300"
                  : "border-stone-700 bg-stone-800 text-stone-400 hover:border-stone-500"
                }`}
              style={active && color ? { borderColor: color, color, backgroundColor: `${color}22` } : undefined}
            >
              {labelMap?.[opt] ?? opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── フォームコンポーネント ───────────────────────────────────────────────
function ThemeForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: Omit<ThemeRow, "id" | "created_at" | "updated_at">;
  onSave:  (v: typeof initial) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const fc = form.filter_config;

  const setFc = (patch: Partial<FilterConfig>) =>
    setForm((f) => ({ ...f, filter_config: { ...f.filter_config, ...patch } }));

  return (
    <div className="bg-stone-800/60 border border-stone-700 rounded-xl p-4 space-y-4">
      {/* 基本情報 */}
      <div className="grid grid-cols-[4rem_1fr] gap-2">
        <div>
          <label className="text-stone-400 text-xs block mb-1">絵文字</label>
          <input
            className="w-full bg-stone-900 border border-stone-700 rounded px-2 py-1.5 text-white text-sm text-center"
            value={form.emoji}
            onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
            maxLength={4}
          />
        </div>
        <div>
          <label className="text-stone-400 text-xs block mb-1">タイトル <span className="text-red-400">*</span></label>
          <input
            className="w-full bg-stone-900 border border-stone-700 rounded px-2 py-1.5 text-white text-sm"
            placeholder="例: 近畿の猛者"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <label className="text-stone-400 text-xs block mb-1">説明</label>
        <input
          className="w-full bg-stone-900 border border-stone-700 rounded px-2 py-1.5 text-white text-sm"
          placeholder="例: 近畿出身力士たちの同郷ネットワーク"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </div>

      {/* フィルター設定 */}
      <div className="border-t border-stone-700 pt-3 space-y-3">
        <p className="text-amber-400 text-xs font-semibold">🔧 フィルター設定</p>

        {/* 時代 */}
        <div>
          <p className="text-stone-400 text-xs font-medium mb-1.5">時代</p>
          <div className="flex gap-2">
            {ERA_OPTIONS.map((era) => (
              <button
                key={era}
                type="button"
                onClick={() => setFc({ era })}
                className={`px-3 py-1 rounded text-xs border transition-colors
                  ${fc.era === era
                    ? "border-amber-500 bg-amber-500/20 text-amber-300"
                    : "border-stone-700 bg-stone-800 text-stone-400 hover:border-stone-500"
                  }`}
              >
                {era}
              </button>
            ))}
          </div>
        </div>

        {/* 番付 */}
        <div>
          <p className="text-stone-400 text-xs font-medium mb-1.5">番付</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFc({ rankDivisions: [] })}
              className={`px-2 py-0.5 rounded text-xs border transition-colors
                ${(fc.rankDivisions ?? []).length === 0
                  ? "border-amber-500 bg-amber-500/20 text-amber-300"
                  : "border-stone-700 bg-stone-800 text-stone-400 hover:border-stone-500"
                }`}
            >
              すべて
            </button>
            {RANK_DIVISION_LIST.map((rd) => {
              const active = (fc.rankDivisions ?? []).includes(rd);
              return (
                <button
                  key={rd}
                  type="button"
                  onClick={() => {
                    const cur = fc.rankDivisions ?? [];
                    setFc({ rankDivisions: active ? cur.filter((x) => x !== rd) : [...cur, rd] });
                  }}
                  className={`px-2 py-0.5 rounded text-xs border transition-colors
                    ${active
                      ? "border-amber-500 bg-amber-500/20 text-amber-300"
                      : "border-stone-700 bg-stone-800 text-stone-400 hover:border-stone-500"
                    }`}
                >
                  {rd}
                </button>
              );
            })}
          </div>
        </div>

        <MultiCheck
          label="関係の種類"
          options={RELATION_TYPES}
          selected={fc.relation_types ?? []}
          onChange={(v) => setFc({ relation_types: v })}
          colorMap={LINK_COLORS as Record<string, string>}
        />
        <MultiCheck
          label="一門"
          options={ICHIMON_LIST}
          selected={(fc.ichimons ?? []) as typeof ICHIMON_LIST[number][]}
          onChange={(v) => setFc({ ichimons: v })}
        />
        <MultiCheck
          label="出身地域"
          options={REGIONS}
          selected={fc.regions ?? []}
          onChange={(v) => setFc({ regions: v })}
        />
        <MultiCheck
          label="学歴"
          options={EDUCATIONS}
          selected={fc.educations ?? []}
          onChange={(v) => setFc({ educations: v })}
        />
        <MultiCheck
          label="年齢グループ"
          options={AGE_GROUPS}
          selected={fc.ageGroups ?? []}
          onChange={(v) => setFc({ ageGroups: v })}
        />
        <MultiCheck
          label="キャリアトレンド"
          options={CAREER_TREND_LIST as unknown as CareerTrend[]}
          selected={(fc.careerTrends ?? []) as CareerTrend[]}
          onChange={(v) => setFc({ careerTrends: v })}
          labelMap={CAREER_TREND_LABELS}
        />
        <MultiCheck
          label="キャリアステージ"
          options={CAREER_STAGE_LIST as unknown as CareerStage[]}
          selected={(fc.careerStages ?? []) as CareerStage[]}
          onChange={(v) => setFc({ careerStages: v })}
          labelMap={CAREER_STAGE_LABELS}
        />
        <MultiCheck
          label="昇進スピード"
          options={PROMOTION_SPEED_LIST as unknown as PromotionSpeed[]}
          selected={(fc.promotionSpeeds ?? []) as PromotionSpeed[]}
          onChange={(v) => setFc({ promotionSpeeds: v })}
          labelMap={PROMOTION_SPEED_LABELS}
        />
      </div>

      {/* 表示順 */}
      <div>
        <label className="text-stone-400 text-xs block mb-1">表示順（数字が小さいほど先頭）</label>
        <input
          type="number"
          className="w-24 bg-stone-900 border border-stone-700 rounded px-2 py-1.5 text-white text-sm"
          value={form.sort_order}
          onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
        />
      </div>

      {/* ボタン */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={saving || !form.label.trim()}
          className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? "保存中..." : "💾 保存"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-sm transition-colors"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}

// ─── メインページ ─────────────────────────────────────────────────────────
export default function ThemesPage() {
  const [themes, setThemes]       = useState<ThemeRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [creating, setCreating]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchThemes = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/themes");
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "取得失敗"); setLoading(false); return; }
    setThemes(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchThemes(); }, [fetchThemes]);

  const handleCreate = async (form: Omit<ThemeRow, "id" | "created_at" | "updated_at">) => {
    setSaving(true);
    const res = await fetch("/api/themes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, filter_config: form.filter_config }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { alert(data.error ?? "作成失敗"); return; }
    setCreating(false);
    fetchThemes();
  };

  const handleUpdate = async (id: string, form: Omit<ThemeRow, "id" | "created_at" | "updated_at">) => {
    setSaving(true);
    const res = await fetch(`/api/themes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { alert(data.error ?? "更新失敗"); return; }
    setEditingId(null);
    fetchThemes();
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/themes/${id}`, { method: "DELETE" });
    if (!res.ok) { alert("削除失敗"); return; }
    setDeleteConfirm(null);
    fetchThemes();
  };

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <div className="border-b border-stone-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <h1 className="text-amber-400 font-bold text-xl">✂️ テーママスタ</h1>
          <AdminNav />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-stone-500 text-sm">
            トップ画面の「今の切り口」に表示されるキュレーションテーマを管理します。
          </p>
          <button
            onClick={() => { setCreating(true); setEditingId(null); }}
            disabled={creating}
            className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            ＋ 新規作成
          </button>
        </div>

        {/* 新規作成フォーム */}
        {creating && (
          <ThemeForm
            initial={EMPTY_FORM}
            onSave={handleCreate}
            onCancel={() => setCreating(false)}
            saving={saving}
          />
        )}

        {/* エラー */}
        {error && (
          <div className="bg-red-950 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* テーマ一覧 */}
        {loading ? (
          <p className="text-stone-500 text-sm">読み込み中...</p>
        ) : themes.length === 0 ? (
          <p className="text-stone-500 text-sm">テーマがありません。「新規作成」から追加してください。</p>
        ) : (
          <div className="space-y-3">
            {themes.map((theme) => (
              <div key={theme.id}>
                {/* 編集フォーム */}
                {editingId === theme.id ? (
                  <ThemeForm
                    initial={{
                      emoji:          theme.emoji,
                      label:          theme.label,
                      description:    theme.description,
                      // show_all_ranks=true の旧テーマは rankDivisions=[] に変換して移行
                      filter_config:  {
                        ...theme.filter_config,
                        rankDivisions: theme.filter_config.rankDivisions
                          ?? (theme.show_all_ranks ? [] : ["幕内", "十両"]),
                        careerTrends:    theme.filter_config.careerTrends    ?? [],
                        careerStages:    theme.filter_config.careerStages    ?? [],
                        promotionSpeeds: theme.filter_config.promotionSpeeds ?? [],
                      },
                      show_all_ranks: false,  // UI では rankDivisions で管理
                      sort_order:     theme.sort_order,
                    }}
                    onSave={(form) => handleUpdate(theme.id, form)}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                  />
                ) : (
                  /* カード表示 */
                  <div className="bg-stone-900/60 border border-stone-700 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xl leading-none">{theme.emoji}</span>
                          <span className="text-white font-semibold text-sm">{theme.label}</span>
                          <span className="text-stone-500 text-xs">#{theme.sort_order}</span>
                        </div>
                        {theme.description && (
                          <p className="text-stone-400 text-xs mt-1">{theme.description}</p>
                        )}
                        {/* フィルター概要 */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {theme.filter_config.era && (
                            <span className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-700 text-stone-400 text-[10px]">
                              {theme.filter_config.era}
                            </span>
                          )}
                          {/* 番付バッジ */}
                          {(theme.filter_config.rankDivisions ?? (theme.show_all_ranks ? [] : ["幕内", "十両"])).length === 0 ? (
                            <span className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-700 text-stone-400 text-[10px]">全番付</span>
                          ) : (theme.filter_config.rankDivisions ?? ["幕内", "十両"]).map((rd) => (
                            <span key={rd} className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-700 text-stone-400 text-[10px]">{rd}</span>
                          ))}
                          {(theme.filter_config.relation_types ?? []).map((rt) => (
                            <span key={rt}
                              className="px-1.5 py-0.5 rounded text-[10px] border"
                              style={{ borderColor: `${(LINK_COLORS as Record<string,string>)[rt]}66`, color: (LINK_COLORS as Record<string,string>)[rt], backgroundColor: `${(LINK_COLORS as Record<string,string>)[rt]}11` }}
                            >
                              {rt}
                            </span>
                          ))}
                          {(theme.filter_config.regions ?? []).map((r) => (
                            <span key={r} className="px-1.5 py-0.5 rounded bg-blue-950/50 border border-blue-800/50 text-blue-400 text-[10px]">{r}</span>
                          ))}
                          {(theme.filter_config.educations ?? []).map((e) => (
                            <span key={e} className="px-1.5 py-0.5 rounded bg-violet-950/50 border border-violet-800/50 text-violet-400 text-[10px]">{e}</span>
                          ))}
                          {(theme.filter_config.ageGroups ?? []).map((a) => (
                            <span key={a} className="px-1.5 py-0.5 rounded bg-emerald-950/50 border border-emerald-800/50 text-emerald-400 text-[10px]">{a}</span>
                          ))}
                          {(theme.filter_config.ichimons ?? []).map((i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-amber-950/50 border border-amber-800/50 text-amber-400 text-[10px]">{i}</span>
                          ))}
                          {(theme.filter_config.careerTrends ?? []).map((ct) => (
                            <span key={ct} className="px-1.5 py-0.5 rounded bg-rose-950/50 border border-rose-800/50 text-rose-400 text-[10px]">
                              {CAREER_TREND_LABELS[ct as CareerTrend] ?? ct}
                            </span>
                          ))}
                          {(theme.filter_config.careerStages ?? []).map((cs) => (
                            <span key={cs} className="px-1.5 py-0.5 rounded bg-cyan-950/50 border border-cyan-800/50 text-cyan-400 text-[10px]">
                              {CAREER_STAGE_LABELS[cs as CareerStage] ?? cs}
                            </span>
                          ))}
                          {(theme.filter_config.promotionSpeeds ?? []).map((ps) => (
                            <span key={ps} className="px-1.5 py-0.5 rounded bg-yellow-950/50 border border-yellow-800/50 text-yellow-400 text-[10px]">
                              {PROMOTION_SPEED_LABELS[ps as PromotionSpeed] ?? ps}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => { setEditingId(theme.id); setCreating(false); }}
                          className="px-2.5 py-1 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs transition-colors"
                        >
                          編集
                        </button>
                        {deleteConfirm === theme.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleDelete(theme.id)}
                              className="px-2.5 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-xs transition-colors"
                            >
                              削除確認
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-2 py-1 rounded bg-stone-700 text-stone-400 text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(theme.id)}
                            className="px-2.5 py-1 rounded bg-stone-700 hover:bg-red-900/60 text-stone-400 hover:text-red-400 text-xs transition-colors"
                          >
                            削除
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}


      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  Rikishi, Heya, OyakataMaster, OyakataNameHistory,
  RikishiStatus, HeyaRole, OyakataHistoryReason, BanzukeEntry, Basho,
  RelationType,
} from "@/types";
import SchoolCombobox from "@/components/SchoolCombobox";
import RikishiCombobox from "@/components/RikishiCombobox";
import Link from "next/link";

// ─── 定数 ────────────────────────────────────────────────────────────────────

const RANK_OPTIONS = [
  ["yokozuna", "横綱"], ["ozeki", "大関"], ["sekiwake", "関脇"],
  ["komusubi", "小結"], ["maegashira", "前頭"], ["juryo", "十両"],
  ["makushita", "幕下"], ["sandanme", "三段目"], ["jonidan", "序二段"],
  ["jonokuchi", "序ノ口"],
] as const;

const END_REASONS: OyakataHistoryReason[] = [
  "定年返上", "退職", "死亡", "名跡移転", "その他",
];
const TAKE_REASONS: OyakataHistoryReason[] = [
  "就任", "継承", "名跡移転", "その他",
];

// ─── 型 ──────────────────────────────────────────────────────────────────────

type Tab = "basic" | "status" | "enishi" | "shisho" | "history";

// HistoryItem は OyakataNameHistory の alias（oyakata_master が JOIN で返る形式）
type HistoryItem = OyakataNameHistory;

type ModalState =
  | { mode: "take" }
  | { mode: "end";      histId: string }
  | { mode: "transfer"; histId: string };

interface ModalForm {
  oyakata_master_id: string;
  start_date:        string;
  end_date:          string;
  reason:            string;
  notes:             string;
  new_oyakata_master_id: string;
  transfer_date:     string;
}

// ─── えにし・師匠履歴の型 ─────────────────────────────────────────────────────

interface RelationshipRow {
  id:            string;
  partner:       { id: string; shikona: string; photo_url: string | null; status: string } | null;
  relation_type: RelationType;
  description:   string | null;
  created_at:    string;
  direction:     "a" | "b";
}

interface ShishoHistoryRow {
  id:         string;
  shisho_id:  string;
  shisho:     { id: string; shikona: string; photo_url: string | null } | null;
  from_basho: string | null;
  to_basho:   string | null;
  notes:      string | null;
  created_at: string;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  rikishi:        Rikishi;
  heya:           Heya[];
  oyakataMaster:  OyakataMaster[];
  initialHistory: HistoryItem[];
  initialBanzuke: BanzukeEntry | null;
  bashoList:      Basho[];
}

// ─── スタイル定数 ─────────────────────────────────────────────────────────────

const CLS = {
  input:  "w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500",
  label:  "block text-stone-400 text-xs mb-1",
  btn:    "px-4 py-2 rounded text-sm font-medium transition-colors",
  btnPrimary:   "bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40",
  btnSecondary: "bg-stone-700 hover:bg-stone-600 text-stone-300",
  btnDanger:    "bg-red-900 text-red-300 hover:bg-red-800",
  btnInfo:      "bg-blue-900 text-blue-300 hover:bg-blue-800",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditRikishiForm({
  rikishi, heya, oyakataMaster, initialHistory, initialBanzuke, bashoList,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("basic");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ── 基本情報フォーム ──────────────────────────────────────────────────────
  const [basic, setBasic] = useState({
    shikona:         rikishi.shikona ?? "",
    yomigana:        rikishi.yomigana ?? "",
    real_name:       rikishi.real_name ?? "",
    heya_id:         rikishi.heya_id ?? "",
    born_place:      rikishi.born_place ?? "",
    birth_date:      rikishi.birth_date ?? "",
    nationality:     rikishi.nationality ?? "日本",
    high_school:     (rikishi as unknown as { high_school?: string | null }).high_school ?? "",
    university:      (rikishi as unknown as { university?: string | null }).university ?? "",
    highest_rank:    rikishi.highest_rank ?? "",
    active_from_basho: rikishi.active_from_basho ?? "",
    episodes:        rikishi.episodes ?? "",
    photo_url:       rikishi.photo_url ?? "",
    wiki_url:        rikishi.wiki_url ?? "",
  });
  const setB = (k: keyof typeof basic) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setBasic(p => ({ ...p, [k]: e.target.value }));

  // ── 在籍状態フォーム ──────────────────────────────────────────────────────
  const [status, setStatus] = useState({
    status:          (rikishi.status ?? "active") as RikishiStatus,
    retirement_basho: rikishi.retirement_basho ?? "",
    heya_role:       (rikishi.heya_role ?? "") as HeyaRole | "",
    oyakata_id:      rikishi.oyakata_id ?? "",
    post_type:       (rikishi.oyakata_id ? "oyakata" : "civilian") as "civilian" | "oyakata",
  });

  // ── 番付フォーム ─────────────────────────────────────────────────────────
  const [banzuke, setBanzuke] = useState({
    basho:        initialBanzuke?.basho        ?? "",
    rank_class:   initialBanzuke?.rank_class   ?? "",
    rank_number:  initialBanzuke?.rank_number?.toString() ?? "",
    rank_side:    initialBanzuke?.rank_side    ?? "",
    rank_display: initialBanzuke?.rank_display ?? "",
  });
  const setB2 = (k: keyof typeof banzuke) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setBanzuke(p => ({ ...p, [k]: e.target.value }));

  /** rank_display を rank_class + rank_number + rank_side から自動生成 */
  function autoDisplay(rc: string, rn: string, rs: string): string {
    const prefix: Record<string, string> = {
      yokozuna: "Y", ozeki: "O", sekiwake: "S", komusubi: "K",
      maegashira: "M", juryo: "J",
      makushita: "Ms", sandanme: "Sd", jonidan: "Jd", jonokuchi: "Jk",
    };
    const p = prefix[rc] ?? rc;
    const n = rn ? rn : "";
    const s = rs === "east" ? "e" : rs === "west" ? "w" : "";
    return `${p}${n}${s}`;
  }

  // ── えにし（relationships） ────────────────────────────────────────────────
  const [enishi, setEnishi]           = useState<RelationshipRow[]>([]);
  const [enishiLoaded, setEnishiLoaded] = useState(false);
  const [enishiLoading, setEnishiLoading] = useState(false);
  const [enishiModal, setEnishiModal] = useState(false);
  const [enishiForm, setEnishiForm]   = useState({
    partner_id:    null as string | null,
    relation_type: "師弟（師匠）" as RelationType,
    description:   "",
  });

  const RELATION_TYPES: RelationType[] = [
    "師弟（師匠）", "師弟（弟子）", "親子・兄弟", "兄弟弟子",
    "同郷", "土俵の青春（同高校）", "土俵の青春（同大学）",
    "同期の絆（入門）", "親族", "一門の絆",
  ];

  async function loadEnishi() {
    if (enishiLoaded) return;
    setEnishiLoading(true);
    try {
      const res = await fetch(`/api/rikishi/${rikishi.id}/relationships`);
      const data = await res.json();
      setEnishi(data.relationships ?? []);
      setEnishiLoaded(true);
    } catch { /* ignore */ } finally { setEnishiLoading(false); }
  }

  async function addEnishi() {
    if (!enishiForm.partner_id) { flash("err", "相手の力士を選んでください"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/rikishi/${rikishi.id}/relationships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partner_id:    enishiForm.partner_id,
          relation_type: enishiForm.relation_type,
          description:   enishiForm.description || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "登録失敗");
      setEnishiModal(false);
      setEnishiForm({ partner_id: null, relation_type: "師弟（師匠）", description: "" });
      setEnishiLoaded(false);
      await loadEnishi();
      flash("ok", "えにしを登録しました");
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "エラー");
    } finally { setSaving(false); }
  }

  async function deleteEnishi(relId: string) {
    if (!confirm("このえにしを削除しますか？")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/rikishi/${rikishi.id}/relationships?rel_id=${relId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "削除失敗");
      setEnishi(prev => prev.filter(r => r.id !== relId));
      flash("ok", "えにしを削除しました");
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "エラー");
    } finally { setSaving(false); }
  }

  // ── 師匠履歴 ──────────────────────────────────────────────────────────────
  const [shishoHistory, setShishoHistory]   = useState<ShishoHistoryRow[]>([]);
  const [shishoLoaded, setShishoLoaded]     = useState(false);
  const [shishoLoading, setShishoLoading]   = useState(false);
  const [shishoModal, setShishoModal]       = useState(false);
  const [shishoForm, setShishoForm]         = useState({
    shisho_id:  null as string | null,
    from_basho: "",
    to_basho:   "",
    notes:      "",
  });

  async function loadShishoHistory() {
    if (shishoLoaded) return;
    setShishoLoading(true);
    try {
      const res = await fetch(`/api/rikishi/${rikishi.id}/shisho-history`);
      const data = await res.json();
      setShishoHistory(data.shishoHistory ?? []);
      setShishoLoaded(true);
    } catch { /* ignore */ } finally { setShishoLoading(false); }
  }

  async function addShishoHistory() {
    if (!shishoForm.shisho_id) { flash("err", "師匠を選んでください"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/rikishi/${rikishi.id}/shisho-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shisho_id:  shishoForm.shisho_id,
          from_basho: shishoForm.from_basho || null,
          to_basho:   shishoForm.to_basho   || null,
          notes:      shishoForm.notes      || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "登録失敗");
      setShishoModal(false);
      setShishoForm({ shisho_id: null, from_basho: "", to_basho: "", notes: "" });
      setShishoLoaded(false);
      await loadShishoHistory();
      flash("ok", "師匠履歴を登録しました");
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "エラー");
    } finally { setSaving(false); }
  }

  async function deleteShishoHistory(histId: string) {
    if (!confirm("この師匠履歴を削除しますか？")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/rikishi/${rikishi.id}/shisho-history?hist_id=${histId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "削除失敗");
      setShishoHistory(prev => prev.filter(h => h.id !== histId));
      flash("ok", "師匠履歴を削除しました");
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "エラー");
    } finally { setSaving(false); }
  }

  // タブ切り替え時に遅延ロード
  useEffect(() => {
    if (tab === "enishi") loadEnishi();
    if (tab === "shisho") loadShishoHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ── 名跡履歴 ─────────────────────────────────────────────────────────────
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [mf, setMf] = useState<ModalForm>({
    oyakata_master_id: "", start_date: "", end_date: "",
    reason: "就任", notes: "", new_oyakata_master_id: "", transfer_date: "",
  });
  const setMfVal = (k: keyof ModalForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setMf(p => ({ ...p, [k]: e.target.value }));

  // ── ユーティリティ ────────────────────────────────────────────────────────
  function flash(type: "ok" | "err", text: string) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  }

  async function apiPut(body: Record<string, unknown>) {
    const res = await fetch(`/api/rikishi/${rikishi.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "保存失敗");
  }

  async function refreshHistory() {
    const res = await fetch(`/api/rikishi/${rikishi.id}/oyakata-history`);
    const data = await res.json();
    if (data.history) setHistory(data.history as HistoryItem[]);
  }

  // ── 保存ハンドラ ──────────────────────────────────────────────────────────
  async function saveBasic() {
    setSaving(true);
    try {
      await apiPut({
        ...basic,
        birth_date:        basic.birth_date        || null,
        active_from_basho: basic.active_from_basho || null,
        heya_id:     basic.heya_id     || null,
      });
      flash("ok", "基本情報を保存しました");
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "エラー");
    } finally { setSaving(false); }
  }

  async function saveStatus() {
    setSaving(true);
    try {
      const isRetired = status.status === "retired";
      await apiPut({
        status:          status.status,
        retirement_basho: isRetired ? (status.retirement_basho || null) : null,
        heya_role:        isRetired && status.post_type === "oyakata" ? (status.heya_role || null) : null,
        oyakata_id:       isRetired && status.post_type === "oyakata" ? (status.oyakata_id || null) : null,
      });
      flash("ok", "在籍状態を保存しました");
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "エラー");
    } finally { setSaving(false); }
  }

  async function saveBanzuke() {
    if (!banzuke.basho || !banzuke.rank_class) {
      flash("err", "場所と番付は必須です");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/rikishi/${rikishi.id}/banzuke`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basho:        banzuke.basho,
          rank_class:   banzuke.rank_class,
          rank_number:  banzuke.rank_number  ? parseInt(banzuke.rank_number)  : null,
          rank_side:    banzuke.rank_side    || null,
          rank_display: banzuke.rank_display || autoDisplay(banzuke.rank_class, banzuke.rank_number, banzuke.rank_side) || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "保存失敗");
      const { banzuke: saved } = await res.json() as { banzuke: BanzukeEntry };
      setBanzuke({
        basho:        saved.basho,
        rank_class:   saved.rank_class,
        rank_number:  saved.rank_number?.toString() ?? "",
        rank_side:    saved.rank_side    ?? "",
        rank_display: saved.rank_display ?? "",
      });
      flash("ok", "番付を保存しました");
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "エラー");
    } finally { setSaving(false); }
  }

  // ── 名跡モーダル送信 ──────────────────────────────────────────────────────
  async function submitModal() {
    if (!modal) return;
    setSaving(true);
    try {
      const baseUrl = `/api/rikishi/${rikishi.id}/oyakata-history`;

      if (modal.mode === "take") {
        if (!mf.oyakata_master_id || !mf.start_date) throw new Error("名跡と取得日は必須です");
        const res = await fetch(baseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oyakata_master_id: mf.oyakata_master_id, start_date: mf.start_date, reason: mf.reason, notes: mf.notes || null }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        // 現在の名跡として rikishi.oyakata_id を更新
        await apiPut({ oyakata_id: mf.oyakata_master_id });

      } else if (modal.mode === "end") {
        if (!mf.end_date) throw new Error("終了日は必須です");
        const res = await fetch(`${baseUrl}/${modal.histId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ end_date: mf.end_date, reason: mf.reason }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        // 名跡返上 → oyakata_id をクリア
        await apiPut({ oyakata_id: null, heya_role: null });

      } else if (modal.mode === "transfer") {
        if (!mf.transfer_date || !mf.new_oyakata_master_id) throw new Error("移転日と新名跡は必須です");
        // 1) 旧名跡を終了
        const r1 = await fetch(`${baseUrl}/${modal.histId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ end_date: mf.transfer_date, reason: "名跡移転" }),
        });
        if (!r1.ok) throw new Error((await r1.json()).error);
        // 2) 新名跡を開始
        const r2 = await fetch(baseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oyakata_master_id: mf.new_oyakata_master_id, start_date: mf.transfer_date, reason: "就任", notes: mf.notes || null }),
        });
        if (!r2.ok) throw new Error((await r2.json()).error);
        // 3) rikishi.oyakata_id を新名跡に更新
        await apiPut({ oyakata_id: mf.new_oyakata_master_id });
      }

      await refreshHistory();
      setModal(null);
      flash("ok", "名跡履歴を更新しました");
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "エラー");
    } finally { setSaving(false); }
  }

  function openModal(m: ModalState) {
    const today = new Date().toISOString().split("T")[0];
    setMf({ oyakata_master_id: "", start_date: today, end_date: today, reason: m.mode === "end" ? "定年返上" : "就任", notes: "", new_oyakata_master_id: "", transfer_date: today });
    setModal(m);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-stone-400 hover:text-white text-sm">← 戻る</button>
        <h1 className="text-white text-xl font-bold">{rikishi.shikona} を編集</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full ${status.status === "active" ? "bg-green-900 text-green-300" : "bg-stone-700 text-stone-300"}`}>
          {status.status === "active" ? "現役" : "引退"}
        </span>
      </div>

      {/* メッセージ */}
      {msg && (
        <div className={`mb-4 p-3 rounded text-sm border ${msg.type === "ok" ? "bg-green-900/50 border-green-700 text-green-300" : "bg-red-900/50 border-red-700 text-red-300"}`}>
          {msg.text}
        </div>
      )}

      {/* タブ */}
      <div className="flex gap-1 mb-6 border-b border-stone-800">
        {(["basic", "status", "enishi", "shisho", "history"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-amber-500 text-amber-400" : "border-transparent text-stone-400 hover:text-white"}`}>
            {t === "basic" ? "基本情報" : t === "status" ? "在籍状態" : t === "enishi" ? "えにし" : t === "shisho" ? "師匠履歴" : "名跡履歴"}
          </button>
        ))}
      </div>

      {/* ── Tab: 基本情報 ── */}
      {tab === "basic" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={CLS.label}>四股名 *</label><input className={CLS.input} value={basic.shikona} onChange={setB("shikona")} /></div>
            <div><label className={CLS.label}>読み（ひらがな）</label><input className={CLS.input} value={basic.yomigana} onChange={setB("yomigana")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={CLS.label}>本名</label><input className={CLS.input} value={basic.real_name} onChange={setB("real_name")} /></div>
            <div>
              <label className={CLS.label}>部屋</label>
              <select className={CLS.input} value={basic.heya_id} onChange={setB("heya_id")}>
                <option value="">（未設定）</option>
                {heya.map(h => <option key={h.id} value={h.id}>{h.name}部屋</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className={CLS.label}>出身地</label><input className={CLS.input} value={basic.born_place} onChange={setB("born_place")} /></div>
            <div><label className={CLS.label}>生年月日</label><input type="date" className={CLS.input} value={basic.birth_date} onChange={setB("birth_date")} /></div>
            <div><label className={CLS.label}>国籍</label><input className={CLS.input} value={basic.nationality} onChange={setB("nationality")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SchoolCombobox
              label="高校"
              apiType="high_school"
              value={basic.high_school}
              onChange={(v) => setBasic(p => ({ ...p, high_school: v }))}
            />
            <SchoolCombobox
              label="大学"
              apiType="university"
              value={basic.university}
              onChange={(v) => setBasic(p => ({ ...p, university: v }))}
            />
          </div>
          <div>
            <label className={CLS.label}>最高位</label>
            <select className={CLS.input} value={basic.highest_rank} onChange={setB("highest_rank")}>
              <option value="">（未設定）</option>
              {RANK_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={CLS.label}>初土俵（場所）</label>
              <select
                className={CLS.input}
                value={basic.active_from_basho}
                onChange={setB("active_from_basho")}
              >
                <option value="">（未設定）</option>
                {[...bashoList]
                  .sort((a, b) => b.id.localeCompare(a.id))
                  .map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name ?? b.id}
                    </option>
                  ))}
              </select>
            </div>
            <div />{/* 引退年は在籍状態タブで管理 */}
          </div>
          <div><label className={CLS.label}>エピソード</label><textarea className={CLS.input + " h-24 resize-none"} value={basic.episodes} onChange={setB("episodes")} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={CLS.label}>写真 URL</label><input className={CLS.input} value={basic.photo_url} onChange={setB("photo_url")} /></div>
            <div><label className={CLS.label}>Wikipedia URL</label><input className={CLS.input} value={basic.wiki_url} onChange={setB("wiki_url")} placeholder="例：https://ja.wikipedia.org/wiki/豊昇龍智勝" /></div>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={saveBasic} disabled={saving} className={`${CLS.btn} ${CLS.btnPrimary}`}>
              {saving ? "保存中…" : "基本情報を保存"}
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: 在籍状態 ── */}
      {tab === "status" && (
        <div className="space-y-6">
          {/* ステータス */}
          <div>
            <label className={CLS.label}>ステータス</label>
            <div className="flex gap-6">
              {(["active", "retired"] as RikishiStatus[]).map(s => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="status" value={s} checked={status.status === s}
                    onChange={() => setStatus(p => ({ ...p, status: s, ...(s === "active" ? { retirement_basho: "", heya_role: "", post_type: "civilian" as const, oyakata_id: "" } : {}) }))}
                    className="accent-amber-500" />
                  <span className="text-white text-sm">{s === "active" ? "現役" : "引退"}</span>
                </label>
              ))}
            </div>
          </div>

          {status.status === "retired" && (
            <>
              <div>
                <label className={CLS.label}>引退場所</label>
                <select
                  className={CLS.input + " w-64"}
                  value={status.retirement_basho}
                  onChange={e => setStatus(p => ({ ...p, retirement_basho: e.target.value }))}
                >
                  <option value="">（未設定）</option>
                  {[...bashoList]
                    .sort((a, b) => b.id.localeCompare(a.id))
                    .map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name ?? b.id}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className={CLS.label}>引退後の進路</label>
                <div className="flex gap-6">
                  {([["civilian", "一般引退"], ["oyakata", "親方株取得"]] as const).map(([v, l]) => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="post_type" value={v} checked={status.post_type === v}
                        onChange={() => setStatus(p => ({ ...p, post_type: v, ...(v === "civilian" ? { oyakata_id: "", heya_role: "" } : {}) }))}
                        className="accent-amber-500" />
                      <span className="text-white text-sm">{l}</span>
                    </label>
                  ))}
                </div>
              </div>

              {status.post_type === "oyakata" && (
                <div className="pl-4 border-l-2 border-amber-800 space-y-4">
                  <div>
                    <label className={CLS.label}>現在の名跡</label>
                    <select className={CLS.input}
                      value={status.oyakata_id}
                      onChange={e => setStatus(p => ({ ...p, oyakata_id: e.target.value }))}>
                      <option value="">（選択してください）</option>
                      {oyakataMaster.map(om => (
                        <option key={om.id} value={om.id}>
                          {om.name}（{om.yomigana ?? "?"}）{om.ichimon ? ` — ${om.ichimon}` : ""}
                          {om.is_ichidai_toshiyori ? " ★一代" : ""}
                        </option>
                      ))}
                    </select>
                    <p className="text-stone-500 text-xs mt-1">名跡の変遷は「名跡履歴」タブで管理します</p>
                  </div>
                  <div>
                    <label className={CLS.label}>役割</label>
                    <div className="flex gap-6">
                      {([["shisho", "師匠（部屋責任者）"], ["tsuke_oyakata", "部屋付き親方"]] as const).map(([v, l]) => (
                        <label key={v} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="heya_role" value={v} checked={status.heya_role === v}
                            onChange={() => setStatus(p => ({ ...p, heya_role: v }))}
                            className="accent-amber-500" />
                          <span className="text-white text-sm">{l}</span>
                        </label>
                      ))}
                    </div>
                    {status.heya_role === "shisho" && (
                      <p className="text-amber-600 text-xs mt-1">師匠登録すると、この部屋の力士と師弟関係が発生します</p>
                    )}
                    {status.heya_role === "tsuke_oyakata" && (
                      <p className="text-stone-500 text-xs mt-1">部屋付き親方は師弟関係を結びません</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end pt-2">
            <button onClick={saveStatus} disabled={saving} className={`${CLS.btn} ${CLS.btnPrimary}`}>
              {saving ? "保存中…" : "在籍状態を保存"}
            </button>
          </div>

          {/* ── 現役力士のみ: 現在番付（読み取り専用） ── */}
          {status.status === "active" && (
            <div className="mt-6 pt-6 border-t border-stone-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-medium text-sm">現在番付</h3>
                {banzuke.basho && (
                  <Link
                    href={`/banzuke/${banzuke.basho}/edit`}
                    className="text-xs px-2 py-1 bg-stone-800 hover:bg-stone-700 text-amber-400 rounded transition-colors"
                  >
                    番付表で編集 →
                  </Link>
                )}
              </div>

              {banzuke.basho ? (
                <div className="bg-stone-900 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-amber-300 font-bold text-lg">
                      {banzuke.rank_display || autoDisplay(banzuke.rank_class, banzuke.rank_number, banzuke.rank_side)}
                    </span>
                    <span className="text-stone-400 text-sm">
                      {banzuke.basho}
                    </span>
                  </div>
                  <div className="text-stone-500 text-xs">
                    {banzuke.rank_side === "east" ? "東" : banzuke.rank_side === "west" ? "西" : ""}
                    {banzuke.rank_class ? ` ${RANK_OPTIONS.find(([v]) => v === banzuke.rank_class)?.[1] ?? ""}` : ""}
                    {banzuke.rank_number ? ` ${banzuke.rank_number}枚目` : ""}
                  </div>
                  <p className="text-stone-600 text-xs mt-2">
                    番付の編集は「番付表で編集」ページで行ってください
                  </p>
                </div>
              ) : (
                <div className="bg-stone-900 rounded-lg p-4 text-center space-y-3">
                  <p className="text-stone-500 text-sm">番付データなし</p>
                  <p className="text-stone-600 text-xs">番付ページから場所を選択して登録してください</p>
                  <Link
                    href="/banzuke"
                    className="inline-block text-xs px-3 py-1.5 bg-amber-900/50 hover:bg-amber-800/60
                      text-amber-400 rounded transition-colors"
                  >
                    番付ページへ →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: えにし ── */}
      {tab === "enishi" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-medium">えにし（手動関係）</h3>
            <button onClick={() => setEnishiModal(true)} className={`${CLS.btn} ${CLS.btnSecondary} text-xs`}>
              ＋ えにしを追加
            </button>
          </div>
          {enishiLoading && <p className="text-stone-500 text-sm text-center py-8">読み込み中…</p>}
          {!enishiLoading && enishi.length === 0 && (
            <div className="text-stone-500 text-sm text-center py-12 border border-dashed border-stone-800 rounded-lg">
              まだえにしが登録されていません
            </div>
          )}
          {!enishiLoading && enishi.length > 0 && (
            <div className="space-y-2">
              {enishi.map(r => (
                <div key={r.id} className="p-4 rounded-lg border border-stone-700 bg-stone-900 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-amber-300 font-semibold text-sm">{r.partner?.shikona ?? "（不明）"}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-stone-800 text-stone-400">{r.relation_type}</span>
                      {r.partner?.status === "retired" && <span className="text-xs text-stone-600">引退</span>}
                    </div>
                    {r.description && (
                      <p className="text-stone-400 text-xs mt-1 leading-relaxed">{r.description}</p>
                    )}
                  </div>
                  <button onClick={() => deleteEnishi(r.id)} className={`${CLS.btn} ${CLS.btnDanger} text-xs py-1 shrink-0`}>削除</button>
                </div>
              ))}
            </div>
          )}

          {/* えにし追加モーダル */}
          {enishiModal && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
              <div className="bg-stone-900 border border-stone-700 rounded-xl p-6 w-full max-w-sm space-y-4">
                <h3 className="text-white font-bold">えにしを追加</h3>
                <div>
                  <label className={CLS.label}>相手の力士 *</label>
                  <RikishiCombobox
                    value={enishiForm.partner_id}
                    onChange={(id) => setEnishiForm(p => ({ ...p, partner_id: id }))}
                    placeholder="四股名で検索"
                    emptyLabel="（選択してください）"
                  />
                </div>
                <div>
                  <label className={CLS.label}>関係種別 *</label>
                  <select className={CLS.input} value={enishiForm.relation_type}
                    onChange={e => setEnishiForm(p => ({ ...p, relation_type: e.target.value as RelationType }))}>
                    {RELATION_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                  </select>
                </div>
                <div>
                  <label className={CLS.label}>えにしの説明（任意）</label>
                  <textarea
                    className={CLS.input + " h-20 resize-none"}
                    value={enishiForm.description}
                    onChange={e => setEnishiForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="例：高校相撲時代からの旧知。同じ青森出身で切磋琢磨した。"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={() => setEnishiModal(false)} className={`${CLS.btn} ${CLS.btnSecondary}`}>キャンセル</button>
                  <button onClick={addEnishi} disabled={saving} className={`${CLS.btn} ${CLS.btnPrimary}`}>
                    {saving ? "登録中…" : "追加する"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: 師匠履歴 ── */}
      {tab === "shisho" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-medium">師匠履歴</h3>
              <p className="text-stone-500 text-xs mt-0.5">
                現在の師匠: {rikishi.shisho_id ? <span className="text-amber-400">登録済み</span> : <span className="text-stone-600">未設定</span>}
              </p>
            </div>
            <button onClick={() => setShishoModal(true)} className={`${CLS.btn} ${CLS.btnSecondary} text-xs`}>
              ＋ 師匠を追加
            </button>
          </div>
          {shishoLoading && <p className="text-stone-500 text-sm text-center py-8">読み込み中…</p>}
          {!shishoLoading && shishoHistory.length === 0 && (
            <div className="text-stone-500 text-sm text-center py-12 border border-dashed border-stone-800 rounded-lg">
              師匠履歴がありません
              <p className="text-xs mt-1 text-stone-600">migration 016 をまだ適用していない場合は Supabase で実行してください</p>
            </div>
          )}
          {!shishoLoading && shishoHistory.length > 0 && (
            <div className="space-y-2">
              {shishoHistory.map(h => {
                const isCurrent = !h.to_basho;
                return (
                  <div key={h.id} className={`p-4 rounded-lg border ${isCurrent ? "border-amber-700 bg-amber-950/30" : "border-stone-700 bg-stone-900"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">{h.shisho?.shikona ?? "（不明）"}</span>
                          {isCurrent && <span className="text-xs px-1.5 py-0.5 bg-amber-900 text-amber-300 rounded">現在</span>}
                        </div>
                        <div className="text-stone-400 text-xs mt-1">
                          {h.from_basho ?? "（不明）"} 〜 {h.to_basho ?? "現在"}
                        </div>
                        {h.notes && <div className="text-stone-500 text-xs">{h.notes}</div>}
                      </div>
                      <button onClick={() => deleteShishoHistory(h.id)} className={`${CLS.btn} ${CLS.btnDanger} text-xs py-1 shrink-0`}>削除</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 師匠追加モーダル */}
          {shishoModal && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
              <div className="bg-stone-900 border border-stone-700 rounded-xl p-6 w-full max-w-sm space-y-4">
                <h3 className="text-white font-bold">師匠を追加</h3>
                <div>
                  <label className={CLS.label}>師匠 *</label>
                  <RikishiCombobox
                    value={shishoForm.shisho_id}
                    onChange={(id) => setShishoForm(p => ({ ...p, shisho_id: id }))}
                    placeholder="師匠の四股名で検索"
                    emptyLabel="（選択してください）"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={CLS.label}>師弟関係 開始場所</label>
                    <input className={CLS.input} value={shishoForm.from_basho}
                      onChange={e => setShishoForm(p => ({ ...p, from_basho: e.target.value }))}
                      placeholder="例: 2010-01" />
                  </div>
                  <div>
                    <label className={CLS.label}>終了場所（現在は空欄）</label>
                    <input className={CLS.input} value={shishoForm.to_basho}
                      onChange={e => setShishoForm(p => ({ ...p, to_basho: e.target.value }))}
                      placeholder="例: 2020-03" />
                  </div>
                </div>
                <div>
                  <label className={CLS.label}>備考</label>
                  <input className={CLS.input} value={shishoForm.notes}
                    onChange={e => setShishoForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="例：師匠交代、廃部など" />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={() => setShishoModal(false)} className={`${CLS.btn} ${CLS.btnSecondary}`}>キャンセル</button>
                  <button onClick={addShishoHistory} disabled={saving} className={`${CLS.btn} ${CLS.btnPrimary}`}>
                    {saving ? "登録中…" : "追加する"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: 名跡履歴 ── */}
      {tab === "history" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-medium">名跡保有履歴</h3>
            <button onClick={() => openModal({ mode: "take" })}
              className={`${CLS.btn} ${CLS.btnSecondary} text-xs`}>
              ＋ 名跡取得
            </button>
          </div>

          {history.length === 0 ? (
            <div className="text-stone-500 text-sm text-center py-12 border border-dashed border-stone-800 rounded-lg">
              名跡履歴がありません
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(h => {
                const isCurrent = !h.end_date;
                return (
                  <div key={h.id}
                    className={`p-4 rounded-lg border ${isCurrent ? "border-amber-700 bg-amber-950/30" : "border-stone-700 bg-stone-900"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">{h.oyakata_master?.name ?? "（不明）"}親方</span>
                          {isCurrent && <span className="text-xs px-1.5 py-0.5 bg-amber-900 text-amber-300 rounded">現在</span>}
                        </div>
                        <div className="text-stone-400 text-xs mt-1">
                          {h.start_date} 〜 {h.end_date ?? "（保有中）"}
                        </div>
                        {h.reason && <div className="text-stone-500 text-xs">{h.reason}</div>}
                        {h.notes  && <div className="text-stone-600 text-xs">{h.notes}</div>}
                        {h.oyakata_master?.ichimon && (
                          <div className="text-stone-600 text-xs">{h.oyakata_master.ichimon}</div>
                        )}
                      </div>
                      {isCurrent && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => openModal({ mode: "transfer", histId: h.id })}
                            className={`${CLS.btn} ${CLS.btnInfo} text-xs py-1`}>名跡移転</button>
                          <button onClick={() => openModal({ mode: "end", histId: h.id })}
                            className={`${CLS.btn} ${CLS.btnDanger} text-xs py-1`}>名跡終了</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── モーダル ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-white font-bold text-base">
              {modal.mode === "take" ? "名跡取得" : modal.mode === "end" ? "名跡終了" : "名跡移転"}
            </h3>

            {/* 名跡取得 */}
            {modal.mode === "take" && (
              <>
                <div>
                  <label className={CLS.label}>名跡</label>
                  <select className={CLS.input} value={mf.oyakata_master_id} onChange={setMfVal("oyakata_master_id")}>
                    <option value="">選択してください</option>
                    {oyakataMaster.map(om => (
                      <option key={om.id} value={om.id}>{om.name}（{om.yomigana ?? "?"}）</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={CLS.label}>取得日</label>
                  <input type="date" className={CLS.input} value={mf.start_date} onChange={setMfVal("start_date")} />
                </div>
                <div>
                  <label className={CLS.label}>理由</label>
                  <select className={CLS.input} value={mf.reason} onChange={setMfVal("reason")}>
                    {TAKE_REASONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </>
            )}

            {/* 名跡終了 */}
            {modal.mode === "end" && (
              <>
                <div>
                  <label className={CLS.label}>終了日</label>
                  <input type="date" className={CLS.input} value={mf.end_date} onChange={setMfVal("end_date")} />
                </div>
                <div>
                  <label className={CLS.label}>理由</label>
                  <select className={CLS.input} value={mf.reason} onChange={setMfVal("reason")}>
                    {END_REASONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </>
            )}

            {/* 名跡移転 */}
            {modal.mode === "transfer" && (
              <>
                <div>
                  <label className={CLS.label}>移転日</label>
                  <input type="date" className={CLS.input} value={mf.transfer_date} onChange={setMfVal("transfer_date")} />
                </div>
                <div>
                  <label className={CLS.label}>新しい名跡</label>
                  <select className={CLS.input} value={mf.new_oyakata_master_id} onChange={setMfVal("new_oyakata_master_id")}>
                    <option value="">選択してください</option>
                    {oyakataMaster.map(om => (
                      <option key={om.id} value={om.id}>{om.name}（{om.yomigana ?? "?"}）</option>
                    ))}
                  </select>
                </div>
                <p className="text-stone-500 text-xs">旧名跡は指定日で自動終了します</p>
              </>
            )}

            <div>
              <label className={CLS.label}>備考（任意）</label>
              <input className={CLS.input} value={mf.notes} onChange={setMfVal("notes")} placeholder="前任者名・経緯など" />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setModal(null)} className={`${CLS.btn} ${CLS.btnSecondary}`}>キャンセル</button>
              <button onClick={submitModal} disabled={saving} className={`${CLS.btn} ${CLS.btnPrimary}`}>
                {saving ? "処理中…" : "確定"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface OyakataRow {
  id:                   string;
  name:                 string;
  yomigana:             string | null;
  ichimon:              string | null;
  is_ichidai_toshiyori: boolean;
  notes:                string | null;
}

const ICHIMON_OPTIONS = [
  "二所ノ関一門",
  "出羽海一門",
  "高砂一門",
  "時津風一門",
  "伊勢ヶ濱一門",
];

interface FormState {
  name:                 string;
  yomigana:             string;
  ichimon:              string;
  is_ichidai_toshiyori: boolean;
  notes:                string;
}

const emptyForm = (): FormState => ({
  name: "", yomigana: "", ichimon: "", is_ichidai_toshiyori: false, notes: "",
});

function rowToForm(r: OyakataRow): FormState {
  return {
    name:                 r.name,
    yomigana:             r.yomigana  ?? "",
    ichimon:              r.ichimon   ?? "",
    is_ichidai_toshiyori: r.is_ichidai_toshiyori,
    notes:                r.notes     ?? "",
  };
}

interface Props { initialRows: OyakataRow[] }

export default function OyakataManager({ initialRows }: Props) {
  const router = useRouter();
  const [rows,      setRows]      = useState<OyakataRow[]>(initialRows);
  const [form,      setForm]      = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm,  setShowForm]  = useState(false);
  const [error,     setError]     = useState("");
  const [saving,    setSaving]    = useState(false);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [query,     setQuery]     = useState("");

  const filtered = rows.filter(r => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return r.name.toLowerCase().includes(q) ||
           (r.yomigana ?? "").toLowerCase().includes(q);
  });

  function openNew() {
    setEditingId(null);
    setForm(emptyForm());
    setError("");
    setShowForm(true);
  }

  function openEdit(r: OyakataRow) {
    setEditingId(r.id);
    setForm(rowToForm(r));
    setError("");
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    setError("");
  }

  async function save() {
    if (!form.name.trim()) { setError("名跡名は必須です"); return; }
    setSaving(true); setError("");
    const payload = {
      name:                 form.name.trim(),
      yomigana:             form.yomigana.trim() || null,
      ichimon:              form.ichimon || null,
      is_ichidai_toshiyori: form.is_ichidai_toshiyori,
      notes:                form.notes.trim() || null,
    };
    try {
      const url    = editingId ? `/api/oyakata-master/${editingId}` : "/api/oyakata-master";
      const method = editingId ? "PUT" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "保存に失敗しました"); return; }
      router.refresh();
      setShowForm(false);
      setEditingId(null);
      if (editingId) {
        setRows(prev => prev.map(r =>
          r.id === editingId ? { ...r, ...payload } : r
        ));
      } else {
        setRows(prev => [...prev, { id: json.id, ...payload }]
          .sort((a, b) => (a.yomigana ?? a.name).localeCompare(b.yomigana ?? b.name, "ja")));
      }
    } finally {
      setSaving(false);
    }
  }

  async function execDelete() {
    if (!deleteId) return;
    setSaving(true);
    try {
      const res  = await fetch(`/api/oyakata-master/${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { alert(json.error ?? "削除に失敗しました"); return; }
      setRows(prev => prev.filter(r => r.id !== deleteId));
      router.refresh();
    } finally {
      setSaving(false);
      setDeleteId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ツールバー */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-500 text-sm pointer-events-none">🔍</span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="名跡・読み仮名で検索"
            className="bg-stone-900 border border-stone-700 rounded-lg pl-8 pr-3 py-1.5
              text-sm text-white placeholder:text-stone-500 focus:outline-none focus:border-amber-500 w-48"
          />
        </div>
        <p className="text-sm text-stone-500 mr-auto">
          {filtered.length} / {rows.length} 件
        </p>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500
            text-white font-bold text-sm px-4 py-2 rounded-lg transition-colors"
        >
          <span className="text-base leading-none">＋</span> 新規登録
        </button>
      </div>

      {/* フォームパネル */}
      {showForm && (
        <div className="bg-stone-900 border border-stone-700 rounded-xl p-5 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-amber-400">
            {editingId ? "名跡を編集" : "新規名跡登録"}
          </h2>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 名跡名 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-stone-400">名跡名 <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="例：宮城野"
                className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2
                  text-sm text-white placeholder:text-stone-600
                  focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 読み仮名 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-stone-400">読み仮名</label>
              <input
                type="text"
                value={form.yomigana}
                onChange={e => setForm(f => ({ ...f, yomigana: e.target.value }))}
                placeholder="例：みやぎの"
                className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2
                  text-sm text-white placeholder:text-stone-600
                  focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 一門 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-stone-400">一門</label>
              <select
                value={form.ichimon}
                onChange={e => setForm(f => ({ ...f, ichimon: e.target.value }))}
                className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2
                  text-sm text-white focus:outline-none focus:border-amber-500"
              >
                <option value="">選択なし</option>
                {ICHIMON_OPTIONS.map(i => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>

            {/* 一代年寄 */}
            <div className="flex items-center gap-3 pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_ichidai_toshiyori}
                  onChange={e => setForm(f => ({ ...f, is_ichidai_toshiyori: e.target.checked }))}
                  className="w-4 h-4 rounded accent-amber-500"
                />
                <span className="text-sm text-stone-300">一代年寄</span>
              </label>
            </div>

            {/* 備考 */}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs text-stone-400">備考</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="メモ・補足など"
                className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2
                  text-sm text-white placeholder:text-stone-600 resize-none
                  focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* ボタン */}
          <div className="flex gap-2 justify-end">
            <button
              onClick={cancel}
              className="px-4 py-2 text-sm text-stone-400 hover:text-white
                bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-5 py-2 text-sm font-bold text-white
                bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg transition-colors"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      )}

      {/* テーブル */}
      <div className="overflow-x-auto rounded-xl border border-stone-800">
        <table className="w-full text-sm">
          <thead className="bg-stone-900 border-b border-stone-800">
            <tr>
              <th className="text-left px-4 py-2.5 text-stone-400 font-medium">名跡</th>
              <th className="text-left px-4 py-2.5 text-stone-400 font-medium">一門</th>
              <th className="text-left px-4 py-2.5 text-stone-400 font-medium">一代年寄</th>
              <th className="text-left px-4 py-2.5 text-stone-400 font-medium">備考</th>
              <th className="text-right px-4 py-2.5 text-stone-400 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800/50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-500">
                  {query ? "検索結果がありません" : "名跡データがありません"}
                </td>
              </tr>
            )}
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-stone-900/60 transition-colors">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-white">{r.name}</div>
                  {r.yomigana && (
                    <div className="text-xs text-stone-500">{r.yomigana}</div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-stone-400">
                  {r.ichimon ?? <span className="text-stone-700">—</span>}
                </td>
                <td className="px-4 py-2.5">
                  {r.is_ichidai_toshiyori ? (
                    <span className="text-xs text-amber-400 bg-amber-900/30 border border-amber-700/40
                      px-2 py-0.5 rounded-full">一代</span>
                  ) : (
                    <span className="text-stone-700">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-stone-500 text-xs max-w-xs truncate">
                  {r.notes ?? <span className="text-stone-700">—</span>}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => openEdit(r)}
                      className="text-xs px-2.5 py-1 bg-amber-600/20 border border-amber-600/40
                        text-amber-400 hover:bg-amber-600/30 rounded transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => setDeleteId(r.id)}
                      className="text-xs px-2.5 py-1 bg-red-900/20 border border-red-700/40
                        text-red-400 hover:bg-red-900/40 rounded transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 削除確認 */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl p-6 w-80 flex flex-col gap-4">
            <h3 className="font-bold text-white">本当に削除しますか？</h3>
            <p className="text-sm text-stone-400">
              「{rows.find(r => r.id === deleteId)?.name}」を削除します。<br />
              この操作は取り消せません。
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm text-stone-400 hover:text-white
                  bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={execDelete}
                disabled={saving}
                className="px-4 py-2 text-sm font-bold text-white
                  bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded-lg transition-colors"
              >
                {saving ? "削除中…" : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

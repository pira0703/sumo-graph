"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface BashoRow {
  id:         string; // YYYY-MM
  name:       string | null;
  short_name: string | null;
  location:   string | null;
  start_date: string | null;
  end_date:   string | null;
}

const LOCATION_OPTIONS = ["東京", "大阪", "名古屋", "福岡"];

interface FormState {
  id:         string;
  name:       string;
  short_name: string;
  location:   string;
  start_date: string;
  end_date:   string;
}

const emptyForm = (): FormState => ({
  id: "", name: "", short_name: "", location: "", start_date: "", end_date: "",
});

function rowToForm(r: BashoRow): FormState {
  return {
    id:         r.id,
    name:       r.name       ?? "",
    short_name: r.short_name ?? "",
    location:   r.location   ?? "",
    start_date: r.start_date ?? "",
    end_date:   r.end_date   ?? "",
  };
}

/** YYYY-MM から場所名を自動生成するヘルパー */
function autoName(id: string): { name: string; shortName: string } {
  if (!/^\d{4}-\d{2}$/.test(id)) return { name: "", shortName: "" };
  const [year, month] = id.split("-");
  const monthNum = parseInt(month, 10);
  const locMap: Record<number, string> = {
    1: "初場所", 3: "春場所", 5: "夏場所", 7: "名古屋場所", 9: "秋場所", 11: "九州場所",
  };
  const loc = locMap[monthNum] ?? `${monthNum}月場所`;
  return { name: `${year}年${loc}`, shortName: `${year[2]}${year[3]}${loc.replace("場所", "")}` };
}

interface Props { initialRows: BashoRow[] }

export default function BashoManager({ initialRows }: Props) {
  const router = useRouter();
  const [rows,      setRows]      = useState<BashoRow[]>(initialRows);
  const [form,      setForm]      = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm,  setShowForm]  = useState(false);
  const [error,     setError]     = useState("");
  const [saving,    setSaving]    = useState(false);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);

  function handleIdChange(id: string) {
    const auto = autoName(id);
    setForm(f => ({
      ...f,
      id,
      name:       f.name       || auto.name,
      short_name: f.short_name || auto.shortName,
    }));
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyForm());
    setError("");
    setShowForm(true);
  }

  function openEdit(r: BashoRow) {
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
    if (!/^\d{4}-\d{2}$/.test(form.id.trim())) {
      setError("場所IDはYYYY-MM形式で入力してください");
      return;
    }
    setSaving(true); setError("");
    const payload = {
      id:         form.id.trim(),
      name:       form.name.trim()       || null,
      short_name: form.short_name.trim() || null,
      location:   form.location          || null,
      start_date: form.start_date        || null,
      end_date:   form.end_date          || null,
    };
    try {
      const url    = editingId ? `/api/basho/${editingId}` : "/api/basho";
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
        setRows(prev => prev.map(r => r.id === editingId ? { ...payload } : r));
      } else {
        setRows(prev => [payload, ...prev]);
      }
    } finally {
      setSaving(false);
    }
  }

  async function execDelete() {
    if (!deleteId) return;
    setSaving(true);
    try {
      const res  = await fetch(`/api/basho/${deleteId}`, { method: "DELETE" });
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">
          計 <span className="text-white font-medium">{rows.length}</span> 件
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
            {editingId ? "場所を編集" : "新規場所登録"}
          </h2>
          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 場所ID */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-stone-400">
                場所ID <span className="text-red-400">*</span>
                <span className="text-stone-600 ml-1">（YYYY-MM）</span>
              </label>
              <input
                type="text"
                value={form.id}
                onChange={e => editingId ? undefined : handleIdChange(e.target.value)}
                readOnly={!!editingId}
                placeholder="例：2024-01"
                className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500
                  ${editingId
                    ? "bg-stone-800/50 border-stone-700/50 text-stone-500 cursor-not-allowed"
                    : "bg-stone-800 border-stone-700 text-white placeholder:text-stone-600"
                  }`}
              />
            </div>

            {/* 場所名 */}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs text-stone-400">場所名</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="例：2024年初場所"
                className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2
                  text-sm text-white placeholder:text-stone-600
                  focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 略称 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-stone-400">略称</label>
              <input
                type="text"
                value={form.short_name}
                onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))}
                placeholder="例：24初"
                className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2
                  text-sm text-white placeholder:text-stone-600
                  focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 開催地 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-stone-400">開催地</label>
              <select
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2
                  text-sm text-white focus:outline-none focus:border-amber-500"
              >
                <option value="">選択なし</option>
                {LOCATION_OPTIONS.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            {/* 開始日 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-stone-400">開始日</label>
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2
                  text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 終了日 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-stone-400">終了日</label>
              <input
                type="date"
                value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2
                  text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

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
              <th className="text-left px-4 py-2.5 text-stone-400 font-medium">ID</th>
              <th className="text-left px-4 py-2.5 text-stone-400 font-medium">場所名</th>
              <th className="text-left px-4 py-2.5 text-stone-400 font-medium">略称</th>
              <th className="text-left px-4 py-2.5 text-stone-400 font-medium">開催地</th>
              <th className="text-left px-4 py-2.5 text-stone-400 font-medium">開始日</th>
              <th className="text-left px-4 py-2.5 text-stone-400 font-medium">終了日</th>
              <th className="text-right px-4 py-2.5 text-stone-400 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800/50">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-stone-500">
                  場所データがありません
                </td>
              </tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-stone-900/60 transition-colors">
                <td className="px-4 py-2.5 font-mono text-stone-400 text-xs">{r.id}</td>
                <td className="px-4 py-2.5 font-medium text-white">
                  {r.name ?? <span className="text-stone-600">—</span>}
                </td>
                <td className="px-4 py-2.5 text-stone-400">
                  {r.short_name ?? <span className="text-stone-700">—</span>}
                </td>
                <td className="px-4 py-2.5 text-stone-400">
                  {r.location ?? <span className="text-stone-700">—</span>}
                </td>
                <td className="px-4 py-2.5 text-stone-400 text-xs">
                  {r.start_date ?? <span className="text-stone-700">—</span>}
                </td>
                <td className="px-4 py-2.5 text-stone-400 text-xs">
                  {r.end_date ?? <span className="text-stone-700">—</span>}
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
              「{rows.find(r => r.id === deleteId)?.name ?? deleteId}」を削除します。<br />
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

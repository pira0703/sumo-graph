"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface HeyaRow {
  id:           string;
  name:         string;
  ichimon:      string | null;
  created_year: number | null;
  closed_year:  number | null;
}

const ICHIMON_OPTIONS = [
  "二所ノ関一門",
  "出羽海一門",
  "高砂一門",
  "時津風一門",
  "伊勢ヶ濱一門",
];

interface FormState {
  name:         string;
  ichimon:      string;
  created_year: string;
  closed_year:  string;
}

const emptyForm = (): FormState => ({
  name: "", ichimon: "", created_year: "", closed_year: "",
});

function rowToForm(r: HeyaRow): FormState {
  return {
    name:         r.name,
    ichimon:      r.ichimon      ?? "",
    created_year: r.created_year ? String(r.created_year) : "",
    closed_year:  r.closed_year  ? String(r.closed_year)  : "",
  };
}

interface Props { initialRows: HeyaRow[] }

export default function HeyaManager({ initialRows }: Props) {
  const router = useRouter();
  const [rows,       setRows]       = useState<HeyaRow[]>(initialRows);
  const [form,       setForm]       = useState<FormState>(emptyForm());
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [showForm,   setShowForm]   = useState(false);
  const [error,      setError]      = useState("");
  const [saving,     setSaving]     = useState(false);
  const [deleteId,   setDeleteId]   = useState<string | null>(null);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm());
    setError("");
    setShowForm(true);
  }

  function openEdit(r: HeyaRow) {
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
    if (!form.name.trim()) { setError("部屋名は必須です"); return; }
    setSaving(true); setError("");
    const payload = {
      name:         form.name.trim(),
      ichimon:      form.ichimon      || null,
      created_year: form.created_year ? Number(form.created_year) : null,
      closed_year:  form.closed_year  ? Number(form.closed_year)  : null,
    };
    try {
      const url = editingId ? `/api/heya/${editingId}` : "/api/heya";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "保存に失敗しました"); return; }
      router.refresh();
      setShowForm(false);
      setEditingId(null);
      // 楽観的UI更新
      if (editingId) {
        setRows(prev => prev.map(r =>
          r.id === editingId ? { ...r, ...payload } : r
        ));
      } else {
        setRows(prev => [...prev, { id: json.id, ...payload }]
          .sort((a, b) => a.name.localeCompare(b.name, "ja")));
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(id: string) {
    setDeleteId(id);
  }

  async function execDelete() {
    if (!deleteId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/heya/${deleteId}`, { method: "DELETE" });
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
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
          計 <span className="font-medium" style={{ color: "var(--ink)" }}>{rows.length}</span> 件
        </p>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 text-white font-bold text-sm px-4 py-2 rounded-lg transition-colors"
          style={{ backgroundColor: "var(--purple)" }}
        >
          <span className="text-base leading-none">＋</span> 新規登録
        </button>
      </div>

      {/* フォームパネル */}
      {showForm && (
        <div className="rounded-xl p-5 flex flex-col gap-4" style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-bold" style={{ color: "var(--purple)", fontFamily: "'Noto Serif JP', serif" }}>
            {editingId ? "部屋を編集" : "新規部屋登録"}
          </h2>

          {error && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: "#DC2626", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5" }}>{error}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 部屋名 */}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs" style={{ color: "var(--ink-muted)" }}>部屋名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="例：宮城野部屋"
                className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink)" }}
              />
            </div>

            {/* 一門 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--ink-muted)" }}>一門</label>
              <select
                value={form.ichimon}
                onChange={e => setForm(f => ({ ...f, ichimon: e.target.value }))}
                className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink)" }}
              >
                <option value="">選択なし</option>
                {ICHIMON_OPTIONS.map(i => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>

            {/* 創設年 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--ink-muted)" }}>創設年</label>
              <input
                type="number"
                value={form.created_year}
                onChange={e => setForm(f => ({ ...f, created_year: e.target.value }))}
                placeholder="例：1878"
                min={1600} max={2100}
                className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink)" }}
              />
            </div>

            {/* 廃止年 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--ink-muted)" }}>廃止年 <span className="text-xs" style={{ color: "var(--border-dark)" }}>（現存部屋は空欄）</span></label>
              <input
                type="number"
                value={form.closed_year}
                onChange={e => setForm(f => ({ ...f, closed_year: e.target.value }))}
                placeholder="例：2010"
                min={1600} max={2100}
                className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink)" }}
              />
            </div>
          </div>

          {/* ボタン */}
          <div className="flex gap-2 justify-end">
            <button
              onClick={cancel}
              className="px-4 py-2 text-sm rounded-lg transition-colors"
              style={{ backgroundColor: "var(--washi)", border: "1px solid var(--border)", color: "var(--ink-muted)" }}
            >
              キャンセル
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-5 py-2 text-sm font-bold text-white disabled:opacity-50 rounded-lg transition-colors"
              style={{ backgroundColor: "var(--purple)" }}
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      )}

      {/* テーブル */}
      <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: "var(--washi)", borderBottom: "1px solid var(--border)" }}>
            <tr>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--ink-muted)" }}>部屋名</th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--ink-muted)" }}>一門</th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--ink-muted)" }}>創設</th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--ink-muted)" }}>廃止</th>
              <th className="text-right px-4 py-2.5 font-medium" style={{ color: "var(--ink-muted)" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center" style={{ color: "var(--ink-muted)" }}>
                  部屋データがありません
                </td>
              </tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="transition-colors hover:bg-enishi-pale" style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                  {r.name}
                  {r.closed_year && (
                    <span className="ml-2 text-xs font-normal" style={{ color: "var(--border-dark)" }}>（廃止）</span>
                  )}
                </td>
                <td className="px-4 py-2.5" style={{ color: "var(--ink-muted)" }}>
                  {r.ichimon ?? <span style={{ color: "var(--border)" }}>—</span>}
                </td>
                <td className="px-4 py-2.5" style={{ color: "var(--ink-muted)" }}>
                  {r.created_year ?? <span style={{ color: "var(--border)" }}>—</span>}
                </td>
                <td className="px-4 py-2.5" style={{ color: "var(--ink-muted)" }}>
                  {r.closed_year ?? <span style={{ color: "var(--border)" }}>—</span>}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => openEdit(r)}
                      className="text-xs px-2.5 py-1 rounded transition-colors"
                      style={{ backgroundColor: "var(--purple-pale)", border: "1px solid var(--purple)", color: "var(--purple)" }}
                    >
                      編集
                    </button>
                    <button
                      onClick={() => confirmDelete(r.id)}
                      className="text-xs px-2.5 py-1 rounded transition-colors"
                      style={{ backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", color: "#DC2626" }}
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

      {/* 削除確認ダイアログ */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="rounded-2xl p-6 w-80 flex flex-col gap-4" style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)" }}>
            <h3 className="font-bold" style={{ color: "var(--ink)" }}>本当に削除しますか？</h3>
            <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
              「{rows.find(r => r.id === deleteId)?.name}」を削除します。<br />
              この操作は取り消せません。
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm rounded-lg transition-colors"
                style={{ backgroundColor: "var(--washi)", border: "1px solid var(--border)", color: "var(--ink-muted)" }}
              >
                キャンセル
              </button>
              <button
                onClick={execDelete}
                disabled={saving}
                className="px-4 py-2 text-sm font-bold text-white disabled:opacity-50 rounded-lg transition-colors"
                style={{ backgroundColor: "#DC2626" }}
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

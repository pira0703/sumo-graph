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
            {editingId ? "場所を編集" : "新規場所登録"}
          </h2>
          {error && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: "#DC2626", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5" }}>
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 場所ID */}
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--ink-muted)" }}>
                場所ID <span className="text-red-500">*</span>
                <span className="ml-1" style={{ color: "var(--border-dark)" }}>（YYYY-MM）</span>
              </label>
              <input
                type="text"
                value={form.id}
                onChange={e => editingId ? undefined : handleIdChange(e.target.value)}
                readOnly={!!editingId}
                placeholder="例：2024-01"
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={editingId
                  ? { backgroundColor: "var(--washi)", borderColor: "var(--border)", color: "var(--border-dark)", cursor: "not-allowed" }
                  : { backgroundColor: "var(--white)", borderColor: "var(--border)", color: "var(--ink)" }}
              />
            </div>

            {/* 場所名 */}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs" style={{ color: "var(--ink-muted)" }}>場所名</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="例：2024年初場所"
                className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink)" }}
              />
            </div>

            {/* 略称 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--ink-muted)" }}>略称</label>
              <input
                type="text"
                value={form.short_name}
                onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))}
                placeholder="例：24初"
                className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink)" }}
              />
            </div>

            {/* 開催地 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--ink-muted)" }}>開催地</label>
              <select
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink)" }}
              >
                <option value="">選択なし</option>
                {LOCATION_OPTIONS.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            {/* 開始日 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--ink-muted)" }}>開始日</label>
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink)" }}
              />
            </div>

            {/* 終了日 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--ink-muted)" }}>終了日</label>
              <input
                type="date"
                value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink)" }}
              />
            </div>
          </div>

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
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--ink-muted)" }}>ID</th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--ink-muted)" }}>場所名</th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--ink-muted)" }}>略称</th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--ink-muted)" }}>開催地</th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--ink-muted)" }}>開始日</th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--ink-muted)" }}>終了日</th>
              <th className="text-right px-4 py-2.5 font-medium" style={{ color: "var(--ink-muted)" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center" style={{ color: "var(--ink-muted)" }}>
                  場所データがありません
                </td>
              </tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="transition-colors hover:bg-enishi-pale" style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--ink-muted)" }}>{r.id}</td>
                <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                  {r.name ?? <span style={{ color: "var(--border-dark)" }}>—</span>}
                </td>
                <td className="px-4 py-2.5" style={{ color: "var(--ink-muted)" }}>
                  {r.short_name ?? <span style={{ color: "var(--border)" }}>—</span>}
                </td>
                <td className="px-4 py-2.5" style={{ color: "var(--ink-muted)" }}>
                  {r.location ?? <span style={{ color: "var(--border)" }}>—</span>}
                </td>
                <td className="px-4 py-2.5 text-xs" style={{ color: "var(--ink-muted)" }}>
                  {r.start_date ?? <span style={{ color: "var(--border)" }}>—</span>}
                </td>
                <td className="px-4 py-2.5 text-xs" style={{ color: "var(--ink-muted)" }}>
                  {r.end_date ?? <span style={{ color: "var(--border)" }}>—</span>}
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
                      onClick={() => setDeleteId(r.id)}
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

      {/* 削除確認 */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="rounded-2xl p-6 w-80 flex flex-col gap-4" style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)" }}>
            <h3 className="font-bold" style={{ color: "var(--ink)" }}>本当に削除しますか？</h3>
            <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
              「{rows.find(r => r.id === deleteId)?.name ?? deleteId}」を削除します。<br />
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

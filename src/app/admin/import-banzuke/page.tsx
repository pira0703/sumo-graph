"use client";

import { useState } from "react";
import Link from "next/link";

interface SkipItem { row: number; reason: string }
interface ImportResult { ok: boolean; inserted: number; skipped: SkipItem[] }

const SAMPLE_CSV = `basho,shikona,rank_class,rank_number,rank_side
2025-01,照ノ富士,yokozuna,,east
2025-01,琴桜,ozeki,,east
2025-01,豊昇龍,ozeki,,west
2025-01,大の里,maegashira,1,east
2025-01,阿炎,maegashira,1,west`;

export default function ImportBanzukePage() {
  const [csv, setCsv]         = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<ImportResult | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function handleImport() {
    if (!csv.trim()) { setError("CSVを入力してください"); return; }
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/import-banzuke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "インポート失敗");
      setResult(data as ImportResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--washi)", color: "var(--ink)" }}>
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 px-4 py-3" style={{ backgroundColor: "var(--white)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-sm transition-colors hover:text-enishi" style={{ color: "var(--ink-muted)" }}>
            ← 相関図
          </Link>
          <h1 className="font-bold text-lg flex-1" style={{ color: "var(--purple)" }}>番付 CSV インポート</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* 説明 */}
        <div className="rounded-lg p-4 space-y-2 text-sm" style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink)" }}>
          <p className="font-medium">CSVフォーマット（ヘッダー行必須）</p>
          <pre className="text-xs rounded p-3 overflow-x-auto" style={{ backgroundColor: "var(--washi)", color: "var(--ink-muted)" }}>
{`basho,shikona,rank_class,rank_number,rank_side

# basho    : YYYY-MM 形式（01/03/05/07/09/11）
# shikona  : 登録済み力士の四股名と完全一致
# rank_class: yokozuna / ozeki / sekiwake / komusubi / maegashira
#              juryo / makushita / sandanme / jonidan / jonokuchi
# rank_number: 前頭14 → 14、上位4役は空欄可
# rank_side  : east / west`}
          </pre>
          <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
            同じ力士・場所の組み合わせが既に存在する場合は上書きされます。
            shikona が登録済み力士と一致しない行はスキップされます。
          </p>
        </div>

        {/* サンプルCSVを読み込む */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCsv(SAMPLE_CSV)}
            className="text-xs px-3 py-1.5 rounded transition-colors"
            style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink-muted)" }}
          >
            サンプルを読み込む
          </button>
          <button
            type="button"
            onClick={() => { setCsv(""); setResult(null); setError(null); }}
            className="text-xs px-3 py-1.5 rounded transition-colors"
            style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink-muted)" }}
          >
            クリア
          </button>
        </div>

        {/* テキストエリア */}
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--ink-muted)" }}>
            CSV データ（直接貼り付け、または上のボタンでサンプル）
          </label>
          <textarea
            className="w-full rounded px-3 py-2 text-sm font-mono focus:outline-none resize-y"
            style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink)" }}
            rows={14}
            placeholder={SAMPLE_CSV}
            value={csv}
            onChange={e => setCsv(e.target.value)}
          />
        </div>

        {/* 実行ボタン */}
        <div className="flex justify-end">
          <button
            onClick={handleImport}
            disabled={loading || !csv.trim()}
            className="px-6 py-2 rounded text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--purple)" }}
          >
            {loading ? "インポート中…" : "インポート実行"}
          </button>
        </div>

        {/* エラー */}
        {error && (
          <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", color: "#DC2626" }}>
            {error}
          </div>
        )}

        {/* 結果 */}
        {result && (
          <div className="space-y-4">
            {/* サマリー */}
            <div className="rounded-lg p-4" style={{
              backgroundColor: result.skipped.length === 0 ? "#F0FDF4" : "#FFFBEB",
              border: `1px solid ${result.skipped.length === 0 ? "#86EFAC" : "#FCD34D"}`,
            }}>
              <p className="font-medium text-sm" style={{ color: "var(--ink)" }}>インポート完了</p>
              <div className="mt-2 flex gap-6 text-sm">
                <div>
                  <span style={{ color: "var(--ink-muted)" }}>登録成功:</span>{" "}
                  <span className="text-green-600 font-bold">{result.inserted} 件</span>
                </div>
                <div>
                  <span style={{ color: "var(--ink-muted)" }}>スキップ:</span>{" "}
                  <span className={`font-bold ${result.skipped.length > 0 ? "text-amber-600" : ""}`}
                    style={result.skipped.length === 0 ? { color: "var(--ink-muted)" } : undefined}>
                    {result.skipped.length} 件
                  </span>
                </div>
              </div>
            </div>

            {/* スキップ詳細 */}
            {result.skipped.length > 0 && (
              <div className="rounded-lg overflow-hidden" style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)" }}>
                <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>スキップされた行</p>
                </div>
                <table className="w-full text-xs">
                  <thead style={{ borderBottom: "1px solid var(--border)" }}>
                    <tr>
                      <th className="text-left px-4 py-2 w-16" style={{ color: "var(--ink-muted)" }}>行</th>
                      <th className="text-left px-4 py-2" style={{ color: "var(--ink-muted)" }}>理由</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.skipped.map((s, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="px-4 py-2 font-mono" style={{ color: "var(--gold)" }}>{s.row}</td>
                        <td className="px-4 py-2" style={{ color: "var(--ink)" }}>{s.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 番付ページへのリンク */}
            {result.inserted > 0 && (
              <div className="text-center">
                <Link
                  href="/banzuke"
                  className="inline-block text-sm px-4 py-2 rounded transition-colors"
                  style={{ backgroundColor: "var(--purple-pale)", color: "var(--purple)" }}
                >
                  番付ページで確認 →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

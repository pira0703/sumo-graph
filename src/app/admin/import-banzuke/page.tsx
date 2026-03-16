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
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-stone-950 border-b border-stone-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-stone-400 hover:text-amber-400 text-sm transition-colors">
            ← 相関図
          </Link>
          <h1 className="text-amber-400 font-bold text-lg flex-1">番付 CSV インポート</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* 説明 */}
        <div className="bg-stone-900 rounded-lg p-4 space-y-2 text-sm text-stone-300">
          <p className="font-medium text-white">CSVフォーマット（ヘッダー行必須）</p>
          <pre className="text-xs text-stone-400 bg-stone-800 rounded p-3 overflow-x-auto">
{`basho,shikona,rank_class,rank_number,rank_side

# basho    : YYYY-MM 形式（01/03/05/07/09/11）
# shikona  : 登録済み力士の四股名と完全一致
# rank_class: yokozuna / ozeki / sekiwake / komusubi / maegashira
#              juryo / makushita / sandanme / jonidan / jonokuchi
# rank_number: 前頭14 → 14、上位4役は空欄可
# rank_side  : east / west`}
          </pre>
          <p className="text-stone-500 text-xs">
            同じ力士・場所の組み合わせが既に存在する場合は上書きされます。
            shikona が登録済み力士と一致しない行はスキップされます。
          </p>
        </div>

        {/* サンプルCSVを読み込む */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCsv(SAMPLE_CSV)}
            className="text-xs px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded transition-colors"
          >
            サンプルを読み込む
          </button>
          <button
            type="button"
            onClick={() => { setCsv(""); setResult(null); setError(null); }}
            className="text-xs px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-400 rounded transition-colors"
          >
            クリア
          </button>
        </div>

        {/* テキストエリア */}
        <div>
          <label className="block text-stone-400 text-xs mb-1">
            CSV データ（直接貼り付け、または上のボタンでサンプル）
          </label>
          <textarea
            className="w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-sm text-white
              font-mono focus:outline-none focus:border-amber-500 resize-y"
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
            className="px-6 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium
              transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "インポート中…" : "インポート実行"}
          </button>
        </div>

        {/* エラー */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* 結果 */}
        {result && (
          <div className="space-y-4">
            {/* サマリー */}
            <div className={`rounded-lg p-4 border ${
              result.skipped.length === 0
                ? "bg-green-900/30 border-green-700"
                : "bg-amber-900/30 border-amber-700"
            }`}>
              <p className="font-medium text-white text-sm">インポート完了</p>
              <div className="mt-2 flex gap-6 text-sm">
                <div>
                  <span className="text-stone-400">登録成功:</span>{" "}
                  <span className="text-green-400 font-bold">{result.inserted} 件</span>
                </div>
                <div>
                  <span className="text-stone-400">スキップ:</span>{" "}
                  <span className={`font-bold ${result.skipped.length > 0 ? "text-amber-400" : "text-stone-400"}`}>
                    {result.skipped.length} 件
                  </span>
                </div>
              </div>
            </div>

            {/* スキップ詳細 */}
            {result.skipped.length > 0 && (
              <div className="bg-stone-900 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-800">
                  <p className="text-stone-300 text-sm font-medium">スキップされた行</p>
                </div>
                <table className="w-full text-xs">
                  <thead className="text-stone-500 border-b border-stone-800">
                    <tr>
                      <th className="text-left px-4 py-2 w-16">行</th>
                      <th className="text-left px-4 py-2">理由</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.skipped.map((s, i) => (
                      <tr key={i} className="border-b border-stone-800/50">
                        <td className="px-4 py-2 text-amber-400 font-mono">{s.row}</td>
                        <td className="px-4 py-2 text-stone-300">{s.reason}</td>
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
                  className="inline-block text-sm px-4 py-2 bg-stone-800 hover:bg-stone-700
                    text-amber-400 rounded transition-colors"
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

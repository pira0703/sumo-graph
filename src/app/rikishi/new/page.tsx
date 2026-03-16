"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Heya {
  id:   string;
  name: string;
}

interface Basho {
  id:   string;
  name: string | null;
}

const RANK_OPTIONS = [
  ["yokozuna", "横綱"], ["ozeki", "大関"], ["sekiwake", "関脇"],
  ["komusubi", "小結"], ["maegashira", "前頭"], ["juryo", "十両"],
  ["makushita", "幕下"], ["sandanme", "三段目"], ["jonidan", "序二段"],
  ["jonokuchi", "序ノ口"],
] as const;

export default function NewRikishiPage() {
  const router = useRouter();

  const [heya, setHeya]         = useState<Heya[]>([]);
  const [bashoList, setBashoList] = useState<Basho[]>([]);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // フォーム値
  const [shikona,     setShikona]     = useState("");
  const [yomigana,    setYomigana]    = useState("");
  const [heyaId,      setHeyaId]      = useState("");
  const [nationality, setNationality] = useState("日本");
  const [birthDate,   setBirthDate]   = useState("");
  const [activeFromBasho, setActiveFromBasho] = useState("");
  const [highestRank, setHighestRank] = useState("");

  useEffect(() => {
    fetch("/api/heya")
      .then(r => r.json())
      .then(setHeya)
      .catch(() => {});
    fetch("/api/basho")
      .then(r => r.json())
      .then(setBashoList)
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shikona.trim()) { setError("四股名は必須です"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/rikishi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shikona:      shikona.trim(),
          yomigana:     yomigana || undefined,
          heya_id:      heyaId   || undefined,
          nationality:  nationality || undefined,
          birth_date:        birthDate       || undefined,
          active_from_basho: activeFromBasho || undefined,
          highest_rank: highestRank || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "登録に失敗しました"); return; }
      // 作成成功 → 編集ページへ遷移
      router.push(`/rikishi/${json.id}/edit`);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      {/* ヘッダー */}
      <div className="border-b border-stone-800 px-6 py-4 flex items-center gap-4">
        <Link
          href="/admin/rikishi"
          className="text-stone-400 hover:text-amber-400 text-sm transition-colors"
        >
          ← 力士一覧
        </Link>
        <h1 className="text-amber-400 font-bold text-xl">力士 新規登録</h1>
      </div>

      <div className="max-w-xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* 四股名 */}
          <div>
            <label className="block text-sm text-stone-400 mb-1">
              四股名 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={shikona}
              onChange={e => setShikona(e.target.value)}
              placeholder="例：照ノ富士"
              className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2
                text-white placeholder:text-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* 読み仮名 */}
          <div>
            <label className="block text-sm text-stone-400 mb-1">読み仮名</label>
            <input
              type="text"
              value={yomigana}
              onChange={e => setYomigana(e.target.value)}
              placeholder="例：てるのふじ"
              className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2
                text-white placeholder:text-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* 部屋 */}
          <div>
            <label className="block text-sm text-stone-400 mb-1">部屋</label>
            <select
              value={heyaId}
              onChange={e => setHeyaId(e.target.value)}
              className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2
                text-white focus:outline-none focus:border-amber-500"
            >
              <option value="">（未設定）</option>
              {heya.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>

          {/* 国籍 */}
          <div>
            <label className="block text-sm text-stone-400 mb-1">国籍</label>
            <input
              type="text"
              value={nationality}
              onChange={e => setNationality(e.target.value)}
              placeholder="例：モンゴル"
              className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2
                text-white placeholder:text-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* 生年・入幕年 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-stone-400 mb-1">生年月日</label>
              <input
                type="date"
                value={birthDate}
                onChange={e => setBirthDate(e.target.value)}
                className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2
                  text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm text-stone-400 mb-1">初土俵（場所）</label>
              <select
                value={activeFromBasho}
                onChange={e => setActiveFromBasho(e.target.value)}
                className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2
                  text-white focus:outline-none focus:border-amber-500"
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
          </div>



          {/* 最高位 */}
          <div>
            <label className="block text-sm text-stone-400 mb-1">最高位</label>
            <select
              value={highestRank}
              onChange={e => setHighestRank(e.target.value)}
              className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2
                text-white focus:outline-none focus:border-amber-500"
            >
              <option value="">（未設定）</option>
              {RANK_OPTIONS.map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="bg-red-950 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* ボタン */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700
                disabled:text-stone-500 text-white font-bold py-2.5 rounded-lg
                transition-colors"
            >
              {saving ? "登録中..." : "登録して編集画面へ →"}
            </button>
            <Link
              href="/admin/rikishi"
              className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300
                rounded-lg transition-colors text-center"
            >
              キャンセル
            </Link>
          </div>

          <p className="text-xs text-stone-600 text-center">
            登録後、詳細情報（経歴・師匠・親方名等）は編集画面で入力できます
          </p>
        </form>
      </div>
    </div>
  );
}

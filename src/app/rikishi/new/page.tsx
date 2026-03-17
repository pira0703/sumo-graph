"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Heya { id: string; name: string; }
interface Basho { id: string; name: string | null; }

export default function NewRikishiPage() {
  const router  = useRouter();
  const [heya, setHeya]           = useState<Heya[]>([]);
  const [bashoList, setBashoList] = useState<Basho[]>([]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // フォーム値（登録に最低限必要なものだけ）
  const [shikona,          setShikona]          = useState("");
  const [yomigana,         setYomigana]          = useState("");
  const [realName,         setRealName]          = useState("");
  const [heyaId,           setHeyaId]            = useState("");
  const [nationality,      setNationality]       = useState("日本");
  const [bornPlace,        setBornPlace]         = useState("");
  const [birthDate,        setBirthDate]         = useState("");
  const [activeFromBasho,  setActiveFromBasho]   = useState("");

  useEffect(() => {
    fetch("/api/heya").then(r => r.json()).then(setHeya).catch(() => {});
    fetch("/api/basho").then(r => r.json()).then(setBashoList).catch(() => {});
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
          shikona:           shikona.trim(),
          yomigana:          yomigana          || undefined,
          real_name:         realName          || undefined,
          heya_id:           heyaId            || undefined,
          nationality:       nationality       || undefined,
          born_place:        bornPlace         || undefined,
          birth_date:        birthDate         || undefined,
          active_from_basho: activeFromBasho   || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "登録に失敗しました"); return; }
      router.push(`/rikishi/${json.id}/edit`);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  const INPUT = "w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white placeholder:text-stone-500 focus:outline-none focus:border-amber-500";
  const LABEL = "block text-sm text-stone-400 mb-1";

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <div className="border-b border-stone-800 px-6 py-4 flex items-center gap-4">
        <Link href="/admin/rikishi" className="text-stone-400 hover:text-amber-400 text-sm transition-colors">
          ← 力士一覧
        </Link>
        <h1 className="text-amber-400 font-bold text-xl">力士 新規登録</h1>
      </div>

      <div className="max-w-xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* 四股名・読み */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>四股名 <span className="text-red-400">*</span></label>
              <input className={INPUT} value={shikona} onChange={e => setShikona(e.target.value)} placeholder="例：照ノ富士" />
            </div>
            <div>
              <label className={LABEL}>読み仮名</label>
              <input className={INPUT} value={yomigana} onChange={e => setYomigana(e.target.value)} placeholder="例：てるのふじ" />
            </div>
          </div>

          {/* 本名 */}
          <div>
            <label className={LABEL}>本名</label>
            <input className={INPUT} value={realName} onChange={e => setRealName(e.target.value)} placeholder="例：ガントルガ・ガンエルデネ" />
          </div>

          {/* 部屋・国籍 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>部屋</label>
              <select className={INPUT} value={heyaId} onChange={e => setHeyaId(e.target.value)}>
                <option value="">（未設定）</option>
                {heya.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>国籍</label>
              <input className={INPUT} value={nationality} onChange={e => setNationality(e.target.value)} placeholder="例：モンゴル" />
            </div>
          </div>

          {/* 出身地・生年月日 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>出身地（都道府県 / 国）</label>
              <input className={INPUT} value={bornPlace} onChange={e => setBornPlace(e.target.value)} placeholder="例：鹿児島県 / モンゴル" />
            </div>
            <div>
              <label className={LABEL}>生年月日</label>
              <input type="date" className={INPUT} value={birthDate} onChange={e => setBirthDate(e.target.value)} />
            </div>
          </div>

          {/* 初土俵 */}
          <div>
            <label className={LABEL}>初土俵（場所）</label>
            <select className={INPUT} value={activeFromBasho} onChange={e => setActiveFromBasho(e.target.value)}>
              <option value="">（未設定）</option>
              {[...bashoList].sort((a, b) => b.id.localeCompare(a.id)).map(b => (
                <option key={b.id} value={b.id}>{b.name ?? b.id}</option>
              ))}
            </select>
          </div>

          <p className="text-xs text-stone-600 bg-stone-900 rounded-lg px-3 py-2">
            💡 最高位・師匠・えにし・写真は登録後の編集画面で設定できます。
            現役力士の最高位は番付データから自動計算できます。
          </p>

          {error && (
            <div className="bg-red-950 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 disabled:text-stone-500 text-white font-bold py-2.5 rounded-lg transition-colors">
              {saving ? "登録中..." : "登録して編集画面へ →"}
            </button>
            <Link href="/admin/rikishi"
              className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg transition-colors text-center">
              キャンセル
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

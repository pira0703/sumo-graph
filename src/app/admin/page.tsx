import Link from "next/link";
import AdminNav from "@/components/AdminNav";

const CARDS = [
  {
    href:  "/admin/rikishi",
    emoji: "🏆",
    title: "力士マスタ",
    desc:  "力士の登録・編集・引退管理",
    color: "amber",
  },
  {
    href:  "/admin/heya",
    emoji: "🏠",
    title: "部屋マスタ",
    desc:  "部屋の登録・一門情報管理",
    color: "blue",
  },
  {
    href:  "/admin/oyakata",
    emoji: "📛",
    title: "名跡マスタ",
    desc:  "親方株・名跡の登録管理",
    color: "violet",
  },
  {
    href:  "/admin/basho",
    emoji: "🗓",
    title: "場所マスタ",
    desc:  "本場所の日程・開催地管理",
    color: "green",
  },
  {
    href:  "/admin/themes",
    emoji: "✂️",
    title: "テーママスタ",
    desc:  "今の切り口（キュレーションテーマ）の管理",
    color: "rose",
  },
];

const COLOR_MAP: Record<string, string> = {
  amber:  "border-amber-700/40 hover:border-amber-500/60 hover:bg-amber-900/10",
  blue:   "border-blue-700/40  hover:border-blue-500/60  hover:bg-blue-900/10",
  violet: "border-violet-700/40 hover:border-violet-500/60 hover:bg-violet-900/10",
  green:  "border-green-700/40 hover:border-green-500/60 hover:bg-green-900/10",
  rose:   "border-rose-700/40  hover:border-rose-500/60  hover:bg-rose-900/10",
};

export default function AdminIndexPage() {
  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <div className="border-b border-stone-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <h1 className="text-amber-400 font-bold text-xl">⚙️ 管理画面</h1>
          <AdminNav />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <p className="text-stone-500 text-sm mb-6">管理したいマスタを選んでください。</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CARDS.map(c => (
            <Link
              key={c.href}
              href={c.href}
              className={`flex items-start gap-4 p-5 rounded-xl bg-stone-900/60 border transition-all
                ${COLOR_MAP[c.color] ?? ""}`}
            >
              <span className="text-3xl leading-none mt-0.5">{c.emoji}</span>
              <div>
                <div className="font-bold text-white text-base">{c.title}</div>
                <div className="text-sm text-stone-500 mt-0.5">{c.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

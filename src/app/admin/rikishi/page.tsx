import Link from "next/link";
import { createServerClient } from "@/lib/supabase";
import AdminNav from "@/components/AdminNav";
import RikishiListClient, { type RikishiRow } from "@/components/RikishiListClient";

export const revalidate = 0; // 常に最新データを取得

export default async function AdminRikishiPage() {
  const supabase = createServerClient();

  const [rikishiRes, heyaRes] = await Promise.all([
    supabase
      .from("rikishi")
      .select("id, shikona, yomigana, highest_rank, active_from_basho, retirement_basho, status, nationality, heya:heya_id(id, name, ichimon)")
      .order("shikona"),
    supabase
      .from("heya")
      .select("id, name, ichimon")
      .order("name"),
  ]);

  const rows   = (rikishiRes.data ?? []) as unknown as RikishiRow[];
  const heya   = (heyaRes.data   ?? []) as { id: string; name: string; ichimon: string | null }[];

  const activeCount  = rows.filter(r => r.status === "active").length;
  const retiredCount = rows.filter(r => r.status === "retired").length;

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      {/* ヘッダー */}
      <div className="border-b border-stone-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          {/* タイトル＋ナビ */}
          <div className="flex items-center gap-4">
            <h1 className="text-amber-400 font-bold text-xl">🏆 力士マスタ管理</h1>
            <AdminNav />
          </div>

          {/* 統計 + 新規登録ボタン */}
          <div className="flex items-center gap-4">
            <div className="text-sm text-stone-500">
              計 <span className="text-white font-medium">{rows.length}</span> 人
              <span className="ml-2 text-green-500">現役 {activeCount}</span>
              <span className="ml-2 text-stone-600">/ 引退 {retiredCount}</span>
            </div>
            <Link
              href="/rikishi/new"
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500
                text-white font-bold text-sm px-4 py-2 rounded-lg transition-colors"
            >
              <span className="text-base leading-none">＋</span> 新規登録
            </Link>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <RikishiListClient initialRows={rows} heyaOptions={heya} />
      </div>
    </div>
  );
}

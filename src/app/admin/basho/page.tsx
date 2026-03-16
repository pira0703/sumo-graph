import { createServerClient } from "@/lib/supabase";
import AdminNav from "@/components/AdminNav";
import BashoManager, { type BashoRow } from "@/components/BashoManager";

export const revalidate = 0;

export default async function AdminBashoPage() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("basho")
    .select("id, name, short_name, location, start_date, end_date")
    .order("id", { ascending: false });

  const rows: BashoRow[] = (data ?? []) as BashoRow[];

  if (error) console.error("basho fetch error:", error.message);

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      {/* ヘッダー */}
      <div className="border-b border-stone-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <h1 className="text-amber-400 font-bold text-xl">🗓 場所マスタ管理</h1>
            <AdminNav />
          </div>
          <div className="text-sm text-stone-500">
            計 <span className="text-white font-medium">{rows.length}</span> 場所
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        <BashoManager initialRows={rows} />
      </div>
    </div>
  );
}

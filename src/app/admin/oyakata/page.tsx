import { createServerClient } from "@/lib/supabase";
import AdminNav from "@/components/AdminNav";
import OyakataManager, { type OyakataRow } from "@/components/OyakataManager";

export const revalidate = 0;

export default async function AdminOyakataPage() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("oyakata_master")
    .select("id, name, yomigana, ichimon, is_ichidai_toshiyori, notes")
    .order("yomigana", { ascending: true });

  const rows: OyakataRow[] = (data ?? []) as OyakataRow[];
  const ichidaiCount = rows.filter(r => r.is_ichidai_toshiyori).length;

  if (error) console.error("oyakata fetch error:", error.message);

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      {/* ヘッダー */}
      <div className="border-b border-stone-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <h1 className="text-amber-400 font-bold text-xl">📛 名跡マスタ管理</h1>
            <AdminNav />
          </div>
          <div className="text-sm text-stone-500">
            計 <span className="text-white font-medium">{rows.length}</span> 件
            {ichidaiCount > 0 && (
              <span className="ml-2 text-amber-500">一代年寄 {ichidaiCount}</span>
            )}
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        <OyakataManager initialRows={rows} />
      </div>
    </div>
  );
}

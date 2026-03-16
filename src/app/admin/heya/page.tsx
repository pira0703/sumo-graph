import { createServerClient } from "@/lib/supabase";
import AdminNav from "@/components/AdminNav";
import HeyaManager, { type HeyaRow } from "@/components/HeyaManager";

export const revalidate = 0;

export default async function AdminHeyaPage() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("heya")
    .select("id, name, ichimon, created_year, closed_year")
    .order("name");

  const rows: HeyaRow[] = (data ?? []) as HeyaRow[];
  const activeCount  = rows.filter(r => !r.closed_year).length;
  const closedCount  = rows.filter(r =>  r.closed_year).length;

  if (error) console.error("heya fetch error:", error.message);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--washi)", color: "var(--ink)" }}>
      {/* ヘッダー */}
      <div className="px-6 py-4" style={{ backgroundColor: "var(--white)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <h1 className="font-bold text-xl" style={{ color: "var(--purple)" }}>🏠 部屋マスタ管理</h1>
            <AdminNav />
          </div>
          <div className="text-sm" style={{ color: "var(--ink-muted)" }}>
            計 <span className="font-medium" style={{ color: "var(--ink)" }}>{rows.length}</span> 件
            <span className="ml-2 text-green-600">現存 {activeCount}</span>
            <span className="ml-2" style={{ color: "var(--border-dark)" }}>/ 廃止 {closedCount}</span>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        <HeyaManager initialRows={rows} />
      </div>
    </div>
  );
}

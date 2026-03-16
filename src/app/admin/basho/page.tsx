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
    <div className="min-h-screen" style={{ backgroundColor: "var(--washi)", color: "var(--ink)" }}>
      {/* ヘッダー */}
      <div className="px-6 py-4" style={{ backgroundColor: "var(--white)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <h1 className="font-bold text-xl" style={{ color: "var(--purple)" }}>🗓 場所マスタ管理</h1>
            <AdminNav />
          </div>
          <div className="text-sm" style={{ color: "var(--ink-muted)" }}>
            計 <span className="font-medium" style={{ color: "var(--ink)" }}>{rows.length}</span> 場所
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

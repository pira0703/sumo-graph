import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServerClient } from "@/lib/supabase";

const ROLE_LEVELS: Record<string, number> = {
  user: 1, paid: 2, editor: 3, admin: 4,
};

export default async function BanzukeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // セッション確認（cookie ベース）
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin?next=/banzuke");
  }

  // Service Role で profiles を取得（RLS バイパス）
  const serviceSupabase = createServerClient();
  const { data: profile } = await serviceSupabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role as string | null;
  const level = role ? (ROLE_LEVELS[role] ?? 0) : 0;

  if (level < ROLE_LEVELS.paid) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--washi)" }}>
        <div className="max-w-sm w-full mx-4 text-center space-y-6">
          <div className="text-5xl">🔒</div>
          <div>
            <h1 className="text-xl font-bold mb-2" style={{ color: "var(--ink)" }}>番付は有料プランで解禁</h1>
            <p className="text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
              現役・過去の番付を閲覧するには<br />
              有料プランへのアップグレードが必要です。
            </p>
          </div>
          <a
            href="/"
            className="block w-full py-2.5 px-4 rounded-lg text-sm transition-colors"
            style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink)" }}
          >
            ← 相関図に戻る
          </a>
          <p className="text-xs" style={{ color: "var(--border-dark)" }}>
            現在のロール: <span style={{ color: "var(--ink-muted)" }}>{role ?? "なし"}</span>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

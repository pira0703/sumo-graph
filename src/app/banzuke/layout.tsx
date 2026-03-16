import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ROLE_LEVELS: Record<string, number> = {
  user: 1, paid: 2, editor: 3, admin: 4,
};

export default async function BanzukeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 未ログインはログインページへ
  if (!user) {
    redirect("/auth/signin?next=/banzuke");
  }

  // ロール確認
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role as string | null;
  const level = role ? (ROLE_LEVELS[role] ?? 0) : 0;

  // paid 未満はロック画面
  if (level < ROLE_LEVELS.paid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-950">
        <div className="max-w-sm w-full mx-4 text-center space-y-6">
          <div className="text-5xl">🔒</div>
          <div>
            <h1 className="text-white text-xl font-bold mb-2">番付は有料プランで解禁</h1>
            <p className="text-stone-400 text-sm leading-relaxed">
              現役・過去の番付を閲覧するには<br />
              有料プランへのアップグレードが必要です。
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <a
              href="/"
              className="block w-full py-2.5 px-4 rounded-lg bg-stone-800 border border-stone-700
                text-stone-300 text-sm hover:bg-stone-700 transition-colors"
            >
              ← 相関図に戻る
            </a>
          </div>
          <p className="text-stone-600 text-xs">
            現在のロール: <span className="text-stone-400">{role ?? "なし"}</span>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

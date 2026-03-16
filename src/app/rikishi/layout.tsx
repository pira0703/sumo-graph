import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ROLE_LEVELS: Record<string, number> = {
  user: 1, paid: 2, editor: 3, admin: 4,
};

export default async function RikishiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 未ログインはサインインへ
  if (!user) {
    redirect("/auth/signin?next=/");
  }

  // ロール確認
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role as string | null;
  const level = role ? (ROLE_LEVELS[role] ?? 0) : 0;

  // editor 未満はアクセス拒否
  if (level < ROLE_LEVELS.editor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-950">
        <div className="max-w-sm w-full mx-4 text-center space-y-6">
          <div className="text-5xl">🚫</div>
          <div>
            <h1 className="text-white text-xl font-bold mb-2">編集は editor 以上のみ</h1>
            <p className="text-stone-400 text-sm leading-relaxed">
              力士の編集・追加には<br />
              editor 権限が必要です。
            </p>
          </div>
          <a
            href="/"
            className="block w-full py-2.5 px-4 rounded-lg bg-stone-800 border border-stone-700
              text-stone-300 text-sm hover:bg-stone-700 transition-colors"
          >
            ← 相関図に戻る
          </a>
          <p className="text-stone-600 text-xs">
            現在のロール: <span className="text-stone-400">{role ?? "なし"}</span>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

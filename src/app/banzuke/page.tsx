import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase";

// /banzuke → 最新場所へリダイレクト
export default async function BanzukeIndexPage() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("basho")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latest = data?.id ?? "2026-03";
  redirect(`/banzuke/${latest}`);
}

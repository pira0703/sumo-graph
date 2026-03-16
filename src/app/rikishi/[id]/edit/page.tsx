import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase";
import EditRikishiForm from "@/components/EditRikishiForm";
import type { OyakataNameHistory, OyakataMaster, Heya, Rikishi, BanzukeEntry, Basho } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditRikishiPage({ params }: Props) {
  const { id } = await params;
  const supabase = createServerClient();

  const [rikishiRes, heyaRes, oyakataMasterRes, historyRes, banzukeRes, bashoRes] = await Promise.all([
    supabase
      .from("rikishi")
      .select("*, heya(name, ichimon)")
      .eq("id", id)
      .single(),
    supabase
      .from("heya")
      .select("id, name, ichimon")
      .order("name"),
    supabase
      .from("oyakata_master")
      .select("id, name, yomigana, ichimon, is_ichidai_toshiyori, notes, created_at")
      .order("yomigana"),
    supabase
      .from("oyakata_name_history")
      .select("*, oyakata_master(name, yomigana, ichimon)")
      .eq("rikishi_id", id)
      .order("start_date", { ascending: false }),
    supabase
      .from("banzuke")
      .select("*")
      .eq("rikishi_id", id)
      .order("basho", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("basho")
      .select("id, name, short_name, location")
      .order("id", { ascending: false }),
  ]);

  if (rikishiRes.error || !rikishiRes.data) return notFound();

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <EditRikishiForm
        rikishi={rikishiRes.data as Rikishi}
        heya={(heyaRes.data ?? []) as Heya[]}
        oyakataMaster={(oyakataMasterRes.data ?? []) as OyakataMaster[]}
        initialHistory={(historyRes.data ?? []) as OyakataNameHistory[]}
        initialBanzuke={(banzukeRes.data ?? null) as BanzukeEntry | null}
        bashoList={(bashoRes.data ?? []) as Basho[]}
      />
    </div>
  );
}

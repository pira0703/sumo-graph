/**
 * /api/rikishi/[id]/connections
 * 指定力士のつながりを weight 降順 top10 で返す
 *
 * 自動生成（同部屋/同郷/同学校/同一門/師弟）＋手動えにし（enishi テーブル）を統合
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import type { RelationType } from "@/types";

const RELATION_WEIGHT: Record<RelationType, number> = {
  "師弟（師匠）":         4,
  兄弟弟子:               3,
  "土俵の青春（同高校）": 2,
  "土俵の青春（同大学）": 2,
  "同期の絆（入門）":     2,
  同郷:                   1,
  "一門の絆":             1,
};

export interface ConnectionItem {
  id: string;
  shikona: string;
  highest_rank: string | null;
  photo_url: string | null;
  heya: string | null;
  relation_type: string;
  weight: number;
  description: string | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: me, error: meErr } = await supabase
    .from("rikishi")
    .select("id, shikona, heya_id, born_place, high_school, university, shisho_id, heya(name, ichimon)")
    .eq("id", id)
    .single();

  if (meErr || !me) return NextResponse.json({ error: "not found" }, { status: 404 });

  const myHeyaId     = me.heya_id;
  const myPlace      = me.born_place;
  const myHighSchool = (me as unknown as { high_school?: string | null }).high_school;
  const myUniversity = (me as unknown as { university?: string | null }).university;
  const myIchimon    = (me.heya as unknown as { ichimon?: string } | null)?.ichimon;
  const myShisho     = (me as unknown as { shisho_id?: string | null }).shisho_id;

  const { data: all } = await supabase
    .from("rikishi")
    .select("id, shikona, highest_rank, photo_url, heya_id, born_place, high_school, university, shisho_id, heya(name, ichimon)")
    .neq("id", id)
    .eq("status", "active");

  const connections = new Map<string, ConnectionItem>();

  const add = (
    other: { id: string; shikona: string; highest_rank: string | null; photo_url: string | null; heya?: unknown },
    type: string,
    desc: string | null = null
  ) => {
    const w = RELATION_WEIGHT[type as RelationType] ?? 3;
    const existing = connections.get(other.id);
    if (existing && existing.weight >= w) return;
    connections.set(other.id, {
      id:            other.id,
      shikona:       other.shikona,
      highest_rank:  other.highest_rank,
      photo_url:     other.photo_url,
      heya:          (other.heya as { name: string } | null)?.name ?? null,
      relation_type: type,
      weight:        w,
      description:   desc,
    });
  };

  for (const r of all ?? []) {
    const rIchimon    = (r.heya as unknown as { ichimon?: string } | null)?.ichimon;
    const rHighSchool = (r as unknown as { high_school?: string | null }).high_school;
    const rUniversity = (r as unknown as { university?: string | null }).university;

    if (myShisho && myShisho === r.id) { add(r, "師弟（師匠）"); continue; }
    if (myHeyaId && r.heya_id === myHeyaId) { add(r, "兄弟弟子"); continue; }
    if (myIchimon && rIchimon === myIchimon && r.heya_id !== myHeyaId) add(r, "一門の絆");
    if (myPlace && r.born_place === myPlace) add(r, "同郷");
    if (myHighSchool && rHighSchool && myHighSchool === rHighSchool) add(r, "土俵の青春（同高校）");
    if (myUniversity && rUniversity && myUniversity === rUniversity) add(r, "土俵の青春（同大学）");
  }

  // 引退師匠もカバー
  if (myShisho && !connections.has(myShisho)) {
    const { data: shishoRow } = await supabase
      .from("rikishi")
      .select("id, shikona, highest_rank, photo_url, heya:heya_id(name)")
      .eq("id", myShisho)
      .single();
    if (shishoRow) add(shishoRow as unknown as { id: string; shikona: string; highest_rank: string | null; photo_url: string | null; heya?: unknown }, "師弟（師匠）");
  }

  // 手動えにし（enishi テーブル）
  const { data: myEnishi } = await supabase
    .from("enishi_members")
    .select("enishi_id, enishi(relation_type, description)")
    .eq("rikishi_id", id);

  if (myEnishi && myEnishi.length > 0) {
    const enishiIds = myEnishi.map((m) => m.enishi_id);
    const { data: otherMembers } = await supabase
      .from("enishi_members")
      .select("enishi_id, rikishi_id, rikishi:rikishi_id(id, shikona, highest_rank, photo_url, heya:heya_id(name))")
      .in("enishi_id", enishiIds)
      .neq("rikishi_id", id);

    for (const m of otherMembers ?? []) {
      const enishiMeta = myEnishi.find((e) => e.enishi_id === m.enishi_id);
      const meta = (enishiMeta?.enishi as unknown as { relation_type: string; description: string | null } | null);
      const other = m.rikishi as unknown as { id: string; shikona: string; highest_rank: string | null; photo_url: string | null; heya?: unknown } | null;
      if (other && meta) add(other, meta.relation_type, meta.description);
    }
  }

  const sorted = Array.from(connections.values())
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10);

  return NextResponse.json({ connections: sorted });
}

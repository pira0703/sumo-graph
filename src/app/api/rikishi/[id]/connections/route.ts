/**
 * /api/rikishi/[id]/connections
 * 指定力士のつながりを weight 降順 top10 で返す
 *
 * 動的関係（同部屋/同郷/同学校/同一門/師弟）＋手動関係（親子・兄弟/兄弟弟子/親族）を統合
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import type { RelationType } from "@/types";

const RELATION_WEIGHT: Record<RelationType, number> = {
  "親子・兄弟":           5,
  "師弟（師匠）":         4,
  親族:                   4,
  "師弟（弟子）":         3,
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
  relation_type: RelationType;
  weight: number;
  description: string | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  // 対象力士を取得
  const { data: me, error: meErr } = await supabase
    .from("rikishi")
    .select("id, shikona, heya_id, born_place, high_school, university, shisho_id, heya(name, ichimon)")
    .eq("id", id)
    .single();

  if (meErr || !me) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const myHeyaId     = me.heya_id;
  const myPlace      = me.born_place;
  const myHighSchool = (me as unknown as { high_school?: string | null }).high_school;
  const myUniversity = (me as unknown as { university?: string | null }).university;
  const myIchimon    = (me.heya as unknown as { ichimon?: string } | null)?.ichimon;
  const myShisho     = (me as unknown as { shisho_id?: string | null }).shisho_id;

  // 全現役力士を取得（自分以外）
  const { data: all } = await supabase
    .from("rikishi")
    .select("id, shikona, highest_rank, photo_url, heya_id, born_place, high_school, university, shisho_id, heya(name, ichimon)")
    .neq("id", id)
    .eq("status", "active");

  const connections = new Map<string, ConnectionItem>();

  const add = (
    other: { id: string; shikona: string; highest_rank: string | null; photo_url: string | null; heya?: unknown },
    type: RelationType,
    desc: string | null = null
  ) => {
    const w = RELATION_WEIGHT[type] ?? 1;
    const existing = connections.get(other.id);
    // 既にある場合は weight が高い方を優先
    if (existing && existing.weight >= w) return;
    connections.set(other.id, {
      id:           other.id,
      shikona:      other.shikona,
      highest_rank: other.highest_rank,
      photo_url:    other.photo_url,
      heya:         (other.heya as { name: string } | null)?.name ?? null,
      relation_type: type,
      weight:       w,
      description:  desc,
    });
  };

  for (const r of all ?? []) {
    const rIchimon    = (r.heya as unknown as { ichimon?: string } | null)?.ichimon;
    const rHighSchool = (r as unknown as { high_school?: string | null }).high_school;
    const rUniversity = (r as unknown as { university?: string | null }).university;
    const rShisho     = (r as unknown as { shisho_id?: string | null }).shisho_id;

    // 師弟（師匠）: 自分の shisho_id が相手の id → 弟子から見た師匠 weight=4
    if (myShisho && myShisho === r.id) {
      add(r, "師弟（師匠）");
      continue;
    }
    // 師弟（弟子）: 相手の shisho_id が自分の id → 師匠から見た弟子 weight=3
    if (rShisho && rShisho === id) {
      add(r, "師弟（弟子）");
      continue;
    }
    // 兄弟弟子（同部屋）
    if (myHeyaId && r.heya_id === myHeyaId) {
      add(r, "兄弟弟子");
      continue;
    }
    // 同一門（異部屋のみ）
    if (myIchimon && rIchimon === myIchimon && r.heya_id !== myHeyaId) {
      add(r, "一門の絆");
    }
    // 同郷
    if (myPlace && r.born_place === myPlace) {
      add(r, "同郷");
    }
    // 土俵の青春（同高校）
    if (myHighSchool && rHighSchool && myHighSchool === rHighSchool) {
      add(r, "土俵の青春（同高校）");
    }
    // 土俵の青春（同大学）
    if (myUniversity && rUniversity && myUniversity === rUniversity) {
      add(r, "土俵の青春（同大学）");
    }
  }

  // ─── 師匠を直接フェッチ（引退済みの場合もカバー） ───────────────────────
  // 上の status=active ループでは引退師匠が漏れるため、shisho_id で直接引く
  if (myShisho && !connections.has(myShisho)) {
    const { data: shishoRow } = await supabase
      .from("rikishi")
      .select("id, shikona, highest_rank, photo_url, heya:heya_id(name)")
      .eq("id", myShisho)
      .single();
    if (shishoRow) {
      add(
        shishoRow as unknown as {
          id: string; shikona: string; highest_rank: string | null;
          photo_url: string | null; heya?: unknown;
        },
        "師弟（師匠）"  // 引退師匠も弟子から見た師匠 weight=4
      );
    }
  }

  // 手動関係（親子・兄弟/兄弟弟子/親族）
  const { data: relA } = await supabase
    .from("relationships")
    .select("rikishi_b_id, relation_type, description, rikishi_b:rikishi_b_id(id, shikona, highest_rank, photo_url, heya:heya_id(name))")
    .eq("rikishi_a_id", id)
    .in("relation_type", ["親子・兄弟", "兄弟弟子", "親族"]);

  const { data: relB } = await supabase
    .from("relationships")
    .select("rikishi_a_id, relation_type, description, rikishi_a:rikishi_a_id(id, shikona, highest_rank, photo_url, heya:heya_id(name))")
    .eq("rikishi_b_id", id)
    .in("relation_type", ["親子・兄弟", "兄弟弟子", "親族"]);

  for (const rel of relA ?? []) {
    const other = rel.rikishi_b as unknown as { id: string; shikona: string; highest_rank: string | null; photo_url: string | null; heya?: unknown };
    if (other) add(other, rel.relation_type as RelationType, rel.description);
  }
  for (const rel of relB ?? []) {
    const other = rel.rikishi_a as unknown as { id: string; shikona: string; highest_rank: string | null; photo_url: string | null; heya?: unknown };
    if (other) add(other, rel.relation_type as RelationType, rel.description);
  }

  // weight 降順にソートして top 10
  const sorted = Array.from(connections.values())
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10);

  return NextResponse.json({ connections: sorted });
}

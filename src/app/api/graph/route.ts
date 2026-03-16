/**
 * graph/route.ts
 * 動的エッジ計算版
 *
 * 関係を relationships テーブルではなく力士の属性から動的に算出する:
 *  - 同部屋:        heya_id が一致              → 兄弟弟子 (weight 3)
 *  - 同郷:          born_place が一致            → 同郷 (weight 1)
 *  - 師弟:          shisho_id が相手の id        → 師弟（師匠）(weight 4)
 *  - 一門の絆:      heya.ichimon が一致・別部屋  → 一門の絆 (weight 1)
 *  - 同高校:        high_school が一致           → 土俵の青春（同高校）(weight 2)
 *  - 同大学:        university が一致            → 土俵の青春（同大学）(weight 2)
 *  - 同期の絆（入門）: active_from_basho が一致  → 同期の絆（入門）(weight 2)
 *
 * 手動関係 (親子・兄弟/親族) は relationships テーブルから取得 (weight 5/4)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import type { GraphData, GraphNode, GraphLink, RelationType, CareerTrend, CareerStage, PromotionSpeed } from "@/types";

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

function edgeKey(a: string, b: string, type: string): string {
  return `${[a, b].sort().join("|")}:${type}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const heyaFilters    = searchParams.getAll("heya");
  const ichimonFilters = searchParams.getAll("ichimon");
  const relTypeFilters = searchParams.getAll("relation_type") as RelationType[];
  const era            = searchParams.get("era") ?? "全員";

  const supabase = createServerClient();

  // ─── 力士クエリ ─────────────────────────────────────────────────────────────
  let rikishiQuery = supabase
    .from("rikishi")
    .select(`
      id, shikona, highest_rank, heya_id, born_place, birth_date,
      active_from_basho, status, retirement_basho, photo_url,
      shisho_id, high_school, university,
      career_trend, career_stage, promotion_speed,
      heya(name, ichimon)
    `)
    .range(0, 9999);

  if (heyaFilters.length === 1) rikishiQuery = rikishiQuery.eq("heya_id", heyaFilters[0]);
  else if (heyaFilters.length > 1) rikishiQuery = rikishiQuery.in("heya_id", heyaFilters);
  if (era === "現役") rikishiQuery = rikishiQuery.eq("status", "active");
  if (era === "引退") rikishiQuery = rikishiQuery.eq("status", "retired");

  const { data: rikishiData, error: rErr } = await rikishiQuery;
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  const allRikishi = rikishiData ?? [];

  // ─── 最新 banzuke ────────────────────────────────────────────────────────────
  let banzukeMap = new Map<string, { rank_class: string; rank_display: string }>();
  const { data: latestBashoRow } = await supabase
    .from("banzuke").select("basho").order("basho", { ascending: false }).limit(1).maybeSingle();

  if (latestBashoRow?.basho) {
    const { data: banzukeRows } = await supabase
      .from("banzuke").select("rikishi_id, rank_class, rank_display").eq("basho", latestBashoRow.basho);
    banzukeMap = new Map(
      (banzukeRows ?? []).map((b) => [b.rikishi_id, { rank_class: b.rank_class, rank_display: b.rank_display }])
    );
  }

  // ─── 一門フィルター ───────────────────────────────────────────────────────────
  const filteredRikishi = ichimonFilters.length > 0
    ? allRikishi.filter((r) => {
        const ichimon = (r.heya as unknown as { ichimon?: string } | null)?.ichimon;
        return ichimon != null && ichimonFilters.includes(ichimon);
      })
    : allRikishi;

  if (filteredRikishi.length === 0) return NextResponse.json({ nodes: [], links: [] });

  const idSet = new Set(filteredRikishi.map((r) => r.id));

  // ─── ノード生成 ─────────────────────────────────────────────────────────────
  const nodes: GraphNode[] = filteredRikishi.map((r) => {
    const isActive     = r.status === "active";
    const banzuke      = banzukeMap.get(r.id);
    const rank         = isActive ? (banzuke?.rank_class ?? r.highest_rank) : r.highest_rank;
    const rank_display = isActive ? (banzuke?.rank_display ?? null) : null;
    const raw = r as unknown as Record<string, unknown>;

    return {
      id:                r.id,
      name:              r.shikona,
      rank,
      rank_display,
      heya:              (r.heya as unknown as { name: string } | null)?.name ?? null,
      heya_id:           r.heya_id,
      ichimon:           (r.heya as unknown as { ichimon?: string } | null)?.ichimon ?? null,
      photo_url:         r.photo_url,
      born_place:        r.born_place,
      birth_date:        (raw.birth_date as string | null) ?? null,
      retirement_basho:  r.retirement_basho,
      status:            r.status ?? "active",
      active_from_basho: r.active_from_basho,
      high_school:       (raw.high_school as string | null) ?? null,
      university:        (raw.university as string | null) ?? null,
      career_trend:      (raw.career_trend as CareerTrend | null) ?? null,
      career_stage:      (raw.career_stage as CareerStage | null) ?? null,
      promotion_speed:   (raw.promotion_speed as PromotionSpeed | null) ?? null,
      tags:              [],
    };
  });

  // ─── 動的エッジ生成 ─────────────────────────────────────────────────────────
  const seen  = new Set<string>();
  const links: GraphLink[] = [];

  function addLink(aId: string, bId: string, type: RelationType, description: string | null = null) {
    if (!idSet.has(aId) || !idSet.has(bId)) return;
    const key = edgeKey(aId, bId, type);
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ source: aId, target: bId, type, description, weight: RELATION_WEIGHT[type] ?? 1 });
  }

  function shouldInclude(type: RelationType): boolean {
    return relTypeFilters.length === 0 || relTypeFilters.includes(type);
  }

  // グループ別マップ
  const byHeya         = new Map<string, string[]>();
  const byPlace        = new Map<string, string[]>();
  const byHighSchool   = new Map<string, string[]>();
  const byUniversity   = new Map<string, string[]>();
  const byIchimon      = new Map<string, { id: string; heya_id: string | null }[]>();
  const byDebut        = new Map<string, string[]>();

  for (const r of nodes) {
    if (r.heya_id) {
      if (!byHeya.has(r.heya_id)) byHeya.set(r.heya_id, []);
      byHeya.get(r.heya_id)!.push(r.id);
    }
    if (r.born_place) {
      if (!byPlace.has(r.born_place)) byPlace.set(r.born_place, []);
      byPlace.get(r.born_place)!.push(r.id);
    }
    if (r.high_school) {
      if (!byHighSchool.has(r.high_school)) byHighSchool.set(r.high_school, []);
      byHighSchool.get(r.high_school)!.push(r.id);
    }
    if (r.university) {
      if (!byUniversity.has(r.university)) byUniversity.set(r.university, []);
      byUniversity.get(r.university)!.push(r.id);
    }
    if (r.ichimon) {
      if (!byIchimon.has(r.ichimon)) byIchimon.set(r.ichimon, []);
      byIchimon.get(r.ichimon)!.push({ id: r.id, heya_id: r.heya_id });
    }
    if (r.active_from_basho) {
      if (!byDebut.has(r.active_from_basho)) byDebut.set(r.active_from_basho, []);
      byDebut.get(r.active_from_basho)!.push(r.id);
    }
  }

  // 兄弟弟子（同部屋）weight 3
  if (shouldInclude("兄弟弟子")) {
    for (const members of byHeya.values())
      for (let i = 0; i < members.length; i++)
        for (let j = i + 1; j < members.length; j++)
          addLink(members[i], members[j], "兄弟弟子");
  }

  // 同郷 weight 1
  if (shouldInclude("同郷")) {
    for (const members of byPlace.values()) {
      if (members.length < 2) continue;
      for (let i = 0; i < members.length; i++)
        for (let j = i + 1; j < members.length; j++)
          addLink(members[i], members[j], "同郷");
    }
  }

  // 土俵の青春（同高校）weight 2
  if (shouldInclude("土俵の青春（同高校）")) {
    for (const members of byHighSchool.values()) {
      if (members.length < 2) continue;
      for (let i = 0; i < members.length; i++)
        for (let j = i + 1; j < members.length; j++)
          addLink(members[i], members[j], "土俵の青春（同高校）");
    }
  }

  // 土俵の青春（同大学）weight 2
  if (shouldInclude("土俵の青春（同大学）")) {
    for (const members of byUniversity.values()) {
      if (members.length < 2) continue;
      for (let i = 0; i < members.length; i++)
        for (let j = i + 1; j < members.length; j++)
          addLink(members[i], members[j], "土俵の青春（同大学）");
    }
  }

  // 一門の絆（同部屋は除外）weight 1
  if (shouldInclude("一門の絆")) {
    for (const members of byIchimon.values()) {
      if (members.length < 2) continue;
      for (let i = 0; i < members.length; i++)
        for (let j = i + 1; j < members.length; j++) {
          if (members[i].heya_id && members[j].heya_id && members[i].heya_id === members[j].heya_id) continue;
          addLink(members[i].id, members[j].id, "一門の絆");
        }
    }
  }

  // 同期の絆（入門）weight 2
  if (shouldInclude("同期の絆（入門）")) {
    for (const members of byDebut.values()) {
      if (members.length < 2) continue;
      for (let i = 0; i < members.length; i++)
        for (let j = i + 1; j < members.length; j++)
          addLink(members[i], members[j], "同期の絆（入門）");
    }
  }

  // 師弟（師匠）weight 4
  if (shouldInclude("師弟（師匠）")) {
    for (const r of filteredRikishi) {
      const shishoId = (r as unknown as { shisho_id?: string | null }).shisho_id;
      if (shishoId && idSet.has(shishoId)) addLink(r.id, shishoId, "師弟（師匠）");
    }
  }

  // ─── 手動関係（relationships テーブル）────────────────────────────────────
  const manualTypes = ["親子・兄弟", "親族"] as RelationType[];
  const requestedManualTypes = relTypeFilters.length === 0
    ? manualTypes
    : manualTypes.filter((t) => relTypeFilters.includes(t));

  if (requestedManualTypes.length > 0) {
    const rikishiIds = filteredRikishi.map((r) => r.id);
    const { data: manualData } = await supabase
      .from("relationships")
      .select("rikishi_a_id, rikishi_b_id, relation_type, description")
      .in("rikishi_a_id", rikishiIds)
      .in("rikishi_b_id", rikishiIds)
      .in("relation_type", requestedManualTypes);

    for (const rel of manualData ?? [])
      addLink(rel.rikishi_a_id, rel.rikishi_b_id, rel.relation_type as RelationType, rel.description);
  }

  // ─── relation_type フィルター ─────────────────────────────────────────────
  const finalLinks = relTypeFilters.length > 0
    ? links.filter((l) => relTypeFilters.includes(l.type))
    : links;

  return NextResponse.json({ nodes, links: finalLinks } as GraphData);
}

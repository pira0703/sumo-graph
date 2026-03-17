import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import type { RelationType } from "@/types";

interface Params { params: Promise<{ id: string }> }

// GET /api/rikishi/[id]/relationships
// この力士が関与する relationships 一覧（rikishi_a または rikishi_b）
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();

  const [resA, resB] = await Promise.all([
    supabase
      .from("relationships")
      .select("id, rikishi_a_id, rikishi_b_id, relation_type, description, created_at, rikishi_b:rikishi_b_id(id, shikona, photo_url, status)")
      .eq("rikishi_a_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("relationships")
      .select("id, rikishi_a_id, rikishi_b_id, relation_type, description, created_at, rikishi_a:rikishi_a_id(id, shikona, photo_url, status)")
      .eq("rikishi_b_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (resA.error) return NextResponse.json({ error: resA.error.message }, { status: 500 });
  if (resB.error) return NextResponse.json({ error: resB.error.message }, { status: 500 });

  // 統一形式: { id, partner: { id, shikona, photo_url, status }, relation_type, description, direction: "a"|"b" }
  type PartnerRow = { id: string; shikona: string; photo_url: string | null; status: string } | null;

  const rows = [
    ...(resA.data ?? []).map((r) => ({
      id:            r.id,
      partner:       (r.rikishi_b as unknown) as PartnerRow,
      relation_type: r.relation_type as RelationType,
      description:   r.description,
      created_at:    r.created_at,
      direction:     "a" as const,
    })),
    ...(resB.data ?? []).map((r) => ({
      id:            r.id,
      partner:       (r.rikishi_a as unknown) as PartnerRow,
      relation_type: r.relation_type as RelationType,
      description:   r.description,
      created_at:    r.created_at,
      direction:     "b" as const,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ relationships: rows });
}

// POST /api/rikishi/[id]/relationships
// 新規 relationship 作成
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const partner_id    = (body.partner_id    ?? "").trim();
  const relation_type = (body.relation_type ?? "").trim() as RelationType;
  const description   = (body.description   ?? "").trim() || null;

  if (!partner_id)    return NextResponse.json({ error: "相手の力士IDは必須です" }, { status: 400 });
  if (!relation_type) return NextResponse.json({ error: "関係種別は必須です" },   { status: 400 });
  if (partner_id === id) return NextResponse.json({ error: "自分自身とはえにしを結べません" }, { status: 400 });

  const supabase = createServerClient();

  // 重複チェック
  const { data: existing } = await supabase
    .from("relationships")
    .select("id")
    .or(`and(rikishi_a_id.eq.${id},rikishi_b_id.eq.${partner_id}),and(rikishi_a_id.eq.${partner_id},rikishi_b_id.eq.${id})`)
    .eq("relation_type", relation_type)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "同じ関係がすでに登録されています" }, { status: 409 });

  const { data, error } = await supabase
    .from("relationships")
    .insert({
      rikishi_a_id: id,
      rikishi_b_id: partner_id,
      relation_type,
      description,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}

// DELETE /api/rikishi/[id]/relationships?rel_id=xxx
export async function DELETE(req: NextRequest, { params }: Params) {
  await params; // required for type check
  const rel_id = new URL(req.url).searchParams.get("rel_id");
  if (!rel_id) return NextResponse.json({ error: "rel_id は必須です" }, { status: 400 });

  const supabase = createServerClient();
  const { error } = await supabase.from("relationships").delete().eq("id", rel_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

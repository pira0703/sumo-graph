/**
 * POST /api/rikishi/[id]/generate-image
 *
 * 力士データからAIイラストを生成し、photo_url を更新する。
 *
 * 使用サービス: fal.ai (FLUX 1.1 Pro)
 * 必要な環境変数:
 *   FAL_KEY=xxxxxxxx  ← https://fal.ai/dashboard/keys で取得
 *
 * 画像スタイル: anime/manga illustration（日本の相撲漫画風）
 * ※ 実在の顔写真を生成しているわけではなくキャラクターイラスト
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

interface Params { params: Promise<{ id: string }> }

const RANK_LABELS: Record<string, string> = {
  yokozuna: "横綱", ozeki: "大関", sekiwake: "関脇",
  komusubi: "小結", maegashira: "前頭", juryo: "十両",
  makushita: "幕下", sandanme: "三段目", jonidan: "序二段", jonokuchi: "序ノ口",
};

function buildPrompt(data: {
  shikona: string;
  highest_rank: string | null;
  born_place: string | null;
  nationality: string | null;
  heya_name: string | null;
}) {
  const rank   = data.highest_rank ? RANK_LABELS[data.highest_rank] ?? data.highest_rank : "力士";
  const origin = data.born_place ?? data.nationality ?? "日本";
  const heya   = data.heya_name ? `${data.heya_name}部屋` : "相撲部屋";

  return [
    `Professional sumo wrestler portrait illustration, anime/manga style.`,
    `Character name: ${data.shikona}, rank: ${rank}, from ${origin}, belonging to ${heya}.`,
    `Strong athletic build, wearing traditional mawashi (sumo belt),`,
    `confident expression, stadium background with Japanese aesthetic.`,
    `Clean linework, vibrant colors, high quality illustration.`,
    `Square composition, bust shot.`,
  ].join(" ");
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return NextResponse.json(
      { error: "FAL_KEY が設定されていません。.env.local に FAL_KEY=xxxx を追加してください。" },
      { status: 503 }
    );
  }

  const supabase = createServerClient();

  // 力士データを取得
  const { data: rikishi, error: rErr } = await supabase
    .from("rikishi")
    .select("shikona, highest_rank, born_place, nationality, heya_id, heya(name)")
    .eq("id", id)
    .single();

  if (rErr || !rikishi) {
    return NextResponse.json({ error: "力士が見つかりません" }, { status: 404 });
  }

  const heya_name = (rikishi.heya as unknown as { name: string } | null)?.name ?? null;
  const prompt = buildPrompt({ ...rikishi, heya_name });

  // リクエストボディからスタイルオーバーライドを受け取る
  const body = await req.json().catch(() => ({}));
  const finalPrompt = (body.prompt as string | undefined) ?? prompt;

  // fal.ai FLUX 1.1 Pro を呼び出す
  const falRes = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      "Authorization": `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: finalPrompt,
      image_size: "square_hd",   // 1024×1024
      num_inference_steps: 4,    // schnell は4ステップで十分
      num_images: 1,
    }),
  });

  if (!falRes.ok) {
    const errText = await falRes.text();
    return NextResponse.json({ error: `fal.ai エラー: ${errText}` }, { status: 500 });
  }

  const falData = await falRes.json() as {
    images: Array<{ url: string; width: number; height: number }>;
  };

  const imageUrl = falData.images?.[0]?.url;
  if (!imageUrl) {
    return NextResponse.json({ error: "画像URLが返ってきませんでした" }, { status: 500 });
  }

  // photo_url を更新
  const { error: updateErr } = await supabase
    .from("rikishi")
    .update({ photo_url: imageUrl })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ photo_url: imageUrl, prompt: finalPrompt });
}

// GET: プロンプトのプレビューのみ（画像生成しない）
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: rikishi, error: rErr } = await supabase
    .from("rikishi")
    .select("shikona, highest_rank, born_place, nationality, heya(name)")
    .eq("id", id)
    .single();

  if (rErr || !rikishi) {
    return NextResponse.json({ error: "力士が見つかりません" }, { status: 404 });
  }

  const heya_name = (rikishi.heya as unknown as { name: string } | null)?.name ?? null;
  const prompt = buildPrompt({ ...rikishi, heya_name });

  return NextResponse.json({
    prompt,
    fal_key_set: !!process.env.FAL_KEY,
  });
}

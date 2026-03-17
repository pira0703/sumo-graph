/**
 * POST /api/rikishi/[id]/generate-image
 *
 * 力士の写真をAI生成し photo_url を更新する。
 *
 * 動作モード（自動切替）:
 *   photo_url が登録済み → img2img（元写真を参照して本人らしく生成）
 *   photo_url なし        → text-to-image（テキスト情報から生成）
 *
 * 使用モデル:
 *   img2img:   fal-ai/flux/dev/image-to-image
 *   text2img:  fal-ai/flux-realism
 *
 * 必要な環境変数: FAL_KEY  ← https://fal.ai/dashboard/keys
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

interface Params { params: Promise<{ id: string }> }

const RANK_LABELS: Record<string, string> = {
  yokozuna: "Yokozuna", ozeki: "Ozeki", sekiwake: "Sekiwake",
  komusubi: "Komusubi", maegashira: "Maegashira", juryo: "Juryo",
  makushita: "Makushita", sandanme: "Sandanme", jonidan: "Jonidan", jonokuchi: "Jonokuchi",
};

/** img2img 用プロンプト: 元写真の顔・体型を活かしてポートレートに仕上げる */
function buildImg2ImgPrompt(heya_name: string | null, highest_rank: string | null) {
  const rank = highest_rank ? RANK_LABELS[highest_rank] ?? highest_rank : "sumo wrestler";
  const heya = heya_name ? `${heya_name} stable` : "sumo stable";
  return [
    `Close-up face portrait of a professional sumo wrestler, ${rank} of ${heya}.`,
    `Tight headshot framing, face centered and filling most of the frame,`,
    `perfect for circular avatar crop. Clean neutral dark background,`,
    `dramatic soft lighting, sharp focus on face,`,
    `photorealistic, 8K, DSLR quality portrait photography.`,
  ].join(" ");
}

/** text2img 用プロンプト: 情報のみから生成（写真なしの場合） */
function buildText2ImgPrompt(data: {
  highest_rank: string | null;
  born_place: string | null;
  heya_name: string | null;
}) {
  const rank = data.highest_rank ? RANK_LABELS[data.highest_rank] ?? data.highest_rank : "professional sumo wrestler";
  const heya = data.heya_name ? `${data.heya_name} sumo stable` : "sumo stable";
  return [
    `Photorealistic portrait photograph of a Japanese professional sumo wrestler,`,
    `${rank} rank, ${heya}.`,
    `Wearing traditional black mawashi. Powerful athletic physique,`,
    `short hair, serious dignified expression, traditional Japanese sumo arena background.`,
    `DSLR camera, 85mm lens, shallow depth of field, natural skin texture,`,
    `tight headshot, face centered and filling the frame, perfect for circular avatar crop,`,
    `square format, 8K, photorealistic.`,
  ].join(" ");
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return NextResponse.json(
      { error: "FAL_KEY が設定されていません。Vercel の環境変数に FAL_KEY を追加してください。" },
      { status: 503 }
    );
  }

  const supabase = createServerClient();

  const { data: rikishi, error: rErr } = await supabase
    .from("rikishi")
    .select("shikona, highest_rank, born_place, photo_url, heya_id, heya(name)")
    .eq("id", id)
    .single();

  if (rErr || !rikishi) {
    return NextResponse.json({ error: "力士が見つかりません" }, { status: 404 });
  }

  const heya_name = (rikishi.heya as unknown as { name: string } | null)?.name ?? null;
  const body = await req.json().catch(() => ({}));

  // 既存写真があれば img2img、なければ text2img
  const existingPhotoUrl = rikishi.photo_url as string | null;
  const useImg2Img = !!existingPhotoUrl && !body.ignore_existing_photo;

  let imageUrl: string;

  if (useImg2Img) {
    // ── img2img モード ─────────────────────────────────────────────────────
    const prompt = (body.prompt as string | undefined)
      ?? buildImg2ImgPrompt(heya_name, rikishi.highest_rank);

    const falRes = await fetch("https://fal.run/fal-ai/flux/dev/image-to-image", {
      method: "POST",
      headers: {
        "Authorization": `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_url: existingPhotoUrl,
        strength: 0.65,           // 0=元画像をほぼ維持, 1=完全無視。0.65が本人感を残しつつ改善
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: false,
      }),
    });

    if (!falRes.ok) {
      const errText = await falRes.text();
      return NextResponse.json({ error: `fal.ai エラー (img2img): ${errText}` }, { status: 500 });
    }

    const falData = await falRes.json() as { images: Array<{ url: string }> };
    imageUrl = falData.images?.[0]?.url ?? "";
  } else {
    // ── text2img モード ────────────────────────────────────────────────────
    const prompt = (body.prompt as string | undefined)
      ?? buildText2ImgPrompt({ ...rikishi, heya_name });

    const falRes = await fetch("https://fal.run/fal-ai/flux-realism", {
      method: "POST",
      headers: {
        "Authorization": `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_size: "square_hd",
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
      }),
    });

    if (!falRes.ok) {
      const errText = await falRes.text();
      return NextResponse.json({ error: `fal.ai エラー (text2img): ${errText}` }, { status: 500 });
    }

    const falData = await falRes.json() as { images: Array<{ url: string }> };
    imageUrl = falData.images?.[0]?.url ?? "";
  }

  if (!imageUrl) {
    return NextResponse.json({ error: "画像URLが返ってきませんでした" }, { status: 500 });
  }

  const { error: updateErr } = await supabase
    .from("rikishi")
    .update({ photo_url: imageUrl })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    photo_url: imageUrl,
    mode: useImg2Img ? "img2img" : "text2img",
  });
}

// GET: プレビュー情報のみ（画像生成しない）
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: rikishi, error: rErr } = await supabase
    .from("rikishi")
    .select("shikona, highest_rank, born_place, photo_url, heya(name)")
    .eq("id", id)
    .single();

  if (rErr || !rikishi) {
    return NextResponse.json({ error: "力士が見つかりません" }, { status: 404 });
  }

  const heya_name = (rikishi.heya as unknown as { name: string } | null)?.name ?? null;
  const existingPhotoUrl = rikishi.photo_url as string | null;
  const useImg2Img = !!existingPhotoUrl;

  const prompt = useImg2Img
    ? buildImg2ImgPrompt(heya_name, rikishi.highest_rank)
    : buildText2ImgPrompt({ ...rikishi, heya_name });

  return NextResponse.json({
    prompt,
    mode: useImg2Img ? "img2img" : "text2img",
    existing_photo_url: existingPhotoUrl,
    fal_key_set: !!process.env.FAL_KEY,
  });
}

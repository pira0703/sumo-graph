/**
 * POST /api/rikishi/[id]/generate-image
 *
 * 動作モード（優先順）:
 *   1. reference_image_data_url あり → ペースト画像を fal.ai にアップ → img2img
 *   2. photo_url 登録済み           → 既存写真を img2img で参照
 *   3. どちらもなし                 → text-to-image
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

interface Params { params: Promise<{ id: string }> }

const RANK_LABELS: Record<string, string> = {
  yokozuna: "Yokozuna", ozeki: "Ozeki", sekiwake: "Sekiwake",
  komusubi: "Komusubi", maegashira: "Maegashira", juryo: "Juryo",
  makushita: "Makushita", sandanme: "Sandanme", jonidan: "Jonidan", jonokuchi: "Jonokuchi",
};

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

function buildText2ImgPrompt(data: {
  highest_rank: string | null;
  born_place: string | null;
  heya_name: string | null;
}) {
  const rank = data.highest_rank ? RANK_LABELS[data.highest_rank] ?? data.highest_rank : "professional sumo wrestler";
  const heya = data.heya_name ? `${data.heya_name} sumo stable` : "sumo stable";
  return [
    `Photorealistic close-up portrait photograph of a Japanese professional sumo wrestler,`,
    `${rank} rank, ${heya}.`,
    `Wearing traditional black mawashi. Powerful athletic physique,`,
    `short hair, serious dignified expression, traditional Japanese sumo arena background.`,
    `Tight headshot, face centered and filling the frame, perfect for circular avatar crop,`,
    `DSLR camera, 85mm lens, shallow depth of field, natural skin texture,`,
    `square format, 8K, photorealistic.`,
  ].join(" ");
}

/**
 * base64 data URL を fal.ai ストレージにアップロードして CDN URL を返す
 */
async function uploadToFalStorage(dataUrl: string, falKey: string): Promise<string> {
  // data:image/jpeg;base64,xxxxx → { mimeType, buffer }
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("無効な画像データです");
  const [, mimeType, base64] = match;
  const buffer = Buffer.from(base64, "base64");

  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  formData.append("file", blob, `ref.${ext}`);

  const res = await fetch("https://fal.run/files/upload", {
    method: "POST",
    headers: { "Authorization": `Key ${falKey}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`fal.ai アップロード失敗: ${err}`);
  }

  const data = await res.json() as { url: string };
  return data.url;
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

  // ─── 参照画像 URL を決定 ────────────────────────────────────────────────
  let referenceUrl: string | null = null;
  let mode: "pasted" | "existing" | "text2img" = "text2img";

  if (body.reference_image_data_url) {
    // 優先1: ペーストされたスクショ
    try {
      referenceUrl = await uploadToFalStorage(body.reference_image_data_url as string, falKey);
      mode = "pasted";
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "アップロード失敗" }, { status: 500 });
    }
  } else if (rikishi.photo_url && !body.ignore_existing_photo) {
    // 優先2: 既存の登録写真
    referenceUrl = rikishi.photo_url as string;
    mode = "existing";
  }

  const prompt = (body.prompt as string | undefined)
    ?? (referenceUrl
      ? buildImg2ImgPrompt(heya_name, rikishi.highest_rank)
      : buildText2ImgPrompt({ ...rikishi, heya_name }));

  // ─── fal.ai 呼び出し ────────────────────────────────────────────────────
  let imageUrl: string;

  if (referenceUrl) {
    // img2img
    const falRes = await fetch("https://fal.run/fal-ai/flux/dev/image-to-image", {
      method: "POST",
      headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        image_url: referenceUrl,
        strength: mode === "pasted" ? 0.70 : 0.65,
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: false,
      }),
    });
    if (!falRes.ok) {
      return NextResponse.json({ error: `fal.ai エラー: ${await falRes.text()}` }, { status: 500 });
    }
    const falData = await falRes.json() as { images: Array<{ url: string }> };
    imageUrl = falData.images?.[0]?.url ?? "";
  } else {
    // text2img
    const falRes = await fetch("https://fal.run/fal-ai/flux-realism", {
      method: "POST",
      headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        image_size: "square_hd",
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
      }),
    });
    if (!falRes.ok) {
      return NextResponse.json({ error: `fal.ai エラー: ${await falRes.text()}` }, { status: 500 });
    }
    const falData = await falRes.json() as { images: Array<{ url: string }> };
    imageUrl = falData.images?.[0]?.url ?? "";
  }

  if (!imageUrl) {
    return NextResponse.json({ error: "画像URLが返ってきませんでした" }, { status: 500 });
  }

  const { error: updateErr } = await supabase
    .from("rikishi").update({ photo_url: imageUrl }).eq("id", id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ photo_url: imageUrl, mode });
}

// GET: プレビュー情報のみ
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

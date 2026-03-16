import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // JSA側は「琴櫻」(旧字)、DB側は「琴桜」(新字) → jsa_id=3661 を手動セット
  const { data, error: fetchErr } = await sb
    .from("rikishi")
    .select("id, shikona, jsa_id")
    .eq("shikona", "琴桜")
    .single();

  if (fetchErr) throw new Error(fetchErr.message);
  console.log("Found:", data);

  if (data.jsa_id) {
    console.log("Already has jsa_id:", data.jsa_id);
    return;
  }

  const { error: updateErr } = await sb
    .from("rikishi")
    .update({ jsa_id: 3661 })
    .eq("id", data.id);

  if (updateErr) throw new Error(updateErr.message);
  console.log("✅ Updated 琴桜 → jsa_id = 3661");
}

main().catch(console.error);

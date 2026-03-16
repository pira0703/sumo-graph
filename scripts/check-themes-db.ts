import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data, error } = await supabase
    .from("curated_themes")
    .select("id, filter_config")
    .order("id");
  if (error) { console.error(error); process.exit(1); }
  console.log(JSON.stringify(data, null, 2));
}

main();

/**
 * Wikipedia API 連携
 * 力士の顔写真URLをWikimedia Commonsから取得する
 */

const WIKI_API = "https://ja.wikipedia.org/w/api.php";

export async function fetchRikishiPhoto(
  wikipediaTitle: string
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: "query",
      titles: wikipediaTitle,
      prop: "pageimages",
      pithumbsize: "400",
      format: "json",
      origin: "*",
    });

    const res = await fetch(`${WIKI_API}?${params}`);
    if (!res.ok) return null;

    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as Record<string, unknown>;
    const thumbnail = page?.thumbnail as { source?: string } | undefined;
    return thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

export async function fetchRikishiSummary(
  wikipediaTitle: string
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: "query",
      titles: wikipediaTitle,
      prop: "extracts",
      exintro: "true",
      explaintext: "true",
      exsentences: "5",
      format: "json",
      origin: "*",
    });

    const res = await fetch(`${WIKI_API}?${params}`);
    if (!res.ok) return null;

    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as Record<string, unknown>;
    return (page?.extract as string) ?? null;
  } catch {
    return null;
  }
}

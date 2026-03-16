#!/usr/bin/env python3
"""10名の力士WikipediaエクストラクトをまとめてフェッチしてJSONに保存。"""
import urllib.request, urllib.parse, json, time, os

titles = [
    ("義ノ富士直哉",  "義ノ富士",  "c38f7f3e-19f1-4271-98d1-dc9e3e82290b"),
    ("若ノ勝栄道",    "若ノ勝",    "401d5fa3-7ac1-47cb-889a-b0dc84107089"),
    ("輝大士",        "輝",        "16dd47af-f2cc-4697-b550-cddab0042f72"),
    ("朝翠龍涼馬",    "朝翠龍",    "d2d08746-a9da-43e3-adfe-c767ef34b255"),
    ("旭海雄蓮",      "旭海雄",    "b5ae9887-1bef-4c8c-a328-89a2e53b7243"),
    ("寿之富士大聖",  "寿之富士",  "a644f4ed-caec-4ce9-ae80-96f92e256ba3"),
    ("藤天晴真逢輝",  "藤天晴",    "0cc2f6c6-3fda-4f93-9e1e-f305e79a0fa1"),
    ("一意虎風",      "一意",      "ffe8b36b-62fb-4166-b289-cc63b7dd6a34"),
    ("大青山大介",    "大青山",    "e6a58c2f-c2fe-45d9-af2b-c04cc87bfc5f"),
    ("阿武剋一弘",    "阿武剋",    "d77a15f0-999a-4228-9182-692294270a40"),
]

results = []
for wiki_title, shikona, uuid in titles:
    url = (
        "https://ja.wikipedia.org/w/api.php?action=query&prop=extracts"
        "&explaintext=true&exintro=false&format=json&titles="
        + urllib.parse.quote(wiki_title)
    )
    req = urllib.request.Request(url, headers={"User-Agent": "sumo-graph/1.0"})
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read().decode("utf-8"))
    page = list(data["query"]["pages"].values())[0]
    extract = page.get("extract", "")
    results.append({
        "wiki_title": wiki_title,
        "shikona": shikona,
        "uuid": uuid,
        "extract": extract,
    })
    print(f"✅ {wiki_title}: {len(extract)}文字")
    time.sleep(0.5)

out = "/Users/pipo/Documents/sumo-graph/scripts/data/extra_wrestlers_extracts.json"
with open(out, "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
print(f"\n保存: {out}")

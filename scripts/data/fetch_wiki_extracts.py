#!/usr/bin/env python3
"""
fetch_wiki_extracts.py
Wikipedia Extract API で各力士の記事本文を取得し wiki_extracts/ に保存
"""
import json, os, time, urllib.request, urllib.parse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROGRESS   = os.path.join(SCRIPT_DIR, "wiki_episodes_progress.json")
OUT_DIR    = os.path.join(SCRIPT_DIR, "wiki_extracts")
os.makedirs(OUT_DIR, exist_ok=True)

WIKI_API = "https://ja.wikipedia.org/w/api.php"
HEADERS  = {"User-Agent": "sumo-graph-bot/1.0 (spd.hirata@gmail.com)"}

def fetch_extract(title: str) -> str:
    params = urllib.parse.urlencode({
        "action": "query", "prop": "extracts",
        "exchars": "4000", "titles": title,
        "format": "json", "utf8": "1",
    })
    req = urllib.request.Request(f"{WIKI_API}?{params}", headers=HEADERS)
    with urllib.request.urlopen(req, timeout=10) as res:
        data = json.loads(res.read().decode("utf-8"))
    pages = data.get("query", {}).get("pages", {})
    for page in pages.values():
        return page.get("extract", "") or ""
    return ""

with open(PROGRESS, encoding="utf-8") as f:
    entries = json.load(f)

# pending と skip 以外（= status==pending かつ valid）を取得
target = [e for e in entries if e["status"] == "pending"]
print(f"取得対象: {len(target)}人")

for i, entry in enumerate(target):
    shikona = entry["shikona"]
    title   = urllib.parse.unquote(entry["wiki_url"].split("/wiki/")[-1])
    out_file = os.path.join(OUT_DIR, f"{entry['id']}.txt")

    if os.path.exists(out_file):
        print(f"[{i+1}/{len(target)}] {shikona} - キャッシュあり スキップ")
        continue

    try:
        text = fetch_extract(title)
        with open(out_file, "w", encoding="utf-8") as f:
            f.write(f"# {shikona} / {title}\n\n{text}")
        print(f"[{i+1}/{len(target)}] {shikona} - {len(text)}文字 取得", flush=True)
    except Exception as e:
        print(f"[{i+1}/{len(target)}] {shikona} - ERROR: {e}", flush=True)

    time.sleep(0.5)

print("\n✅ 取得完了")

#!/usr/bin/env python3
"""
fetch_wiki_urls.py  –  Phase 4: Wikipedia wiki_url 一括取得

マッチング戦略:
  1. "{四股名} 力士" でWikipedia検索
  2. タイトルに四股名が含まれる AND スニペットに相撲関連ワードがある → マッチ
  3. 失敗したら "{四股名} 大相撲" でリトライ
  4. それでも無ければ null (status=none)

実行方法:
  cd /Users/pipo/Documents/sumo-graph
  python3 -u scripts/data/fetch_wiki_urls.py
"""
from __future__ import annotations
import json, os, re, time, urllib.request, urllib.parse, urllib.error
from datetime import datetime
from typing import Optional

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
PROGRESS_IN = os.path.join(SCRIPT_DIR, "rikishi_progress.json")
WIKI_OUT    = os.path.join(SCRIPT_DIR, "wiki_progress.json")

WIKI_API = "https://ja.wikipedia.org/w/api.php"
HEADERS  = {"User-Agent": "sumo-graph-bot/1.0 (https://github.com/pira0703/sumo-graph; spd.hirata@gmail.com)"}
SLEEP_SEC = 1.0   # 429対策: 1秒間隔

SUMO_KEYWORDS = {
    "大相撲", "力士", "相撲部屋", "初土俵", "番付",
    "幕内", "十両", "幕下", "横綱", "親方", "場所",
    "三段目", "序二段", "序ノ口", "取組",
}


def search_wiki(query: str, retry: int = 3) -> list[dict]:
    """Wikipedia search API: snippet 付きで最大3件返す。429時は指数バックオフでリトライ"""
    params = urllib.parse.urlencode({
        "action":   "query",
        "list":     "search",
        "srsearch": query,
        "srlimit":  "5",
        "srprop":   "snippet",
        "format":   "json",
        "utf8":     "1",
    })
    for attempt in range(retry):
        try:
            req = urllib.request.Request(f"{WIKI_API}?{params}", headers=HEADERS)
            with urllib.request.urlopen(req, timeout=10) as res:
                data = json.loads(res.read().decode("utf-8"))
            return data.get("query", {}).get("search", [])
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 10 * (2 ** attempt)  # 10s, 20s, 40s
                print(f"\n⚠️  429 Rate limit – waiting {wait}s...", flush=True)
                time.sleep(wait)
            else:
                return []
        except Exception:
            return []
    return []


def strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text)


def title_matches_shikona(shikona: str, title: str) -> bool:
    """四股名がタイトルに含まれるか（異体字ゆれも考慮）"""
    if shikona in title:
        return True
    # 異体字マップ: DB側の新字 → Wikipedia側の旧字/異体字
    VARIANT_MAP = {
        "高": "髙", "浜": "濱", "斎": "齋", "斉": "齊",
        "辺": "邊", "渡": "渡", "桜": "櫻", "滝": "瀧",
        "竜": "龍", "竜": "龍",
    }
    normalized = shikona
    for new, old in VARIANT_MAP.items():
        normalized = normalized.replace(new, old)
    return normalized in title


def is_sumo_article(shikona: str, result: dict) -> Optional[str]:
    """相撲力士の記事であれば URL を返す。違えば None"""
    title   = result["title"]
    snippet = strip_html(result.get("snippet", ""))

    # タイトルに四股名が含まれること（異体字ゆれ考慮）
    if not title_matches_shikona(shikona, title):
        return None

    # スニペットに相撲関連ワードが含まれること
    for kw in SUMO_KEYWORDS:
        if kw in snippet:
            decoded_title = urllib.parse.unquote(title)
            return f"https://ja.wikipedia.org/wiki/{urllib.parse.quote(decoded_title)}"

    return None


def fetch_wiki_url(shikona: str) -> Optional[str]:
    """力士の Wikipedia URL を取得。見つからなければ None"""
    # 3段階の検索戦略:
    #   1. "{四股名} 力士"     – 最も絞り込んだ検索
    #   2. "{四股名} 大相撲"   – 別キーワードでリトライ
    #   3. "{四股名}"          – 単体検索（大の里→大の里泰輝 など本名付き記事をキャッチ）
    for query in [f"{shikona} 力士", f"{shikona} 大相撲", shikona]:
        results = search_wiki(query)
        for r in results:
            url = is_sumo_article(shikona, r)
            if url:
                return url
        time.sleep(0.1)  # クエリ間の短い待機

    return None


# ─── 進捗ファイル ────────────────────────────────────────────────
def load_wiki_progress() -> dict:
    if os.path.exists(WIKI_OUT):
        with open(WIKI_OUT, encoding="utf-8") as f:
            return {e["id"]: e for e in json.load(f)}
    return {}


def save_wiki_progress(entries: list):
    with open(WIKI_OUT, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)


# ─── メイン ──────────────────────────────────────────────────────
def main():
    with open(PROGRESS_IN, encoding="utf-8") as f:
        rikishi_list = json.load(f)

    wiki_map = load_wiki_progress()

    # 進捗エントリ初期化（既存は継続）
    wiki_entries = []
    for r in rikishi_list:
        if r["id"] in wiki_map:
            wiki_entries.append(wiki_map[r["id"]])
        else:
            wiki_entries.append({
                "id":        r["id"],
                "shikona":   r["shikona"],
                "jsa_id":    r["jsa_id"],
                "status":    "pending",
                "wiki_url":  None,
                "fetched_at": None,
            })

    pending = [e for e in wiki_entries if e["status"] == "pending"]
    done    = sum(1 for e in wiki_entries if e["status"] == "done")
    none_   = sum(1 for e in wiki_entries if e["status"] == "none")

    print(f"📂 Loaded {len(wiki_entries)} wrestlers | pending={len(pending)}  done={done}  none={none_}")
    if not pending:
        print("✅ All done already.")
        return
    print(f"🔍 Searching Wikipedia for {len(pending)} wrestlers...\n")

    processed = 0
    for entry in wiki_entries:
        if entry["status"] != "pending":
            continue

        processed += 1
        shikona = entry["shikona"]

        url = fetch_wiki_url(shikona)
        entry["wiki_url"]   = url
        entry["status"]     = "done" if url else "none"
        entry["fetched_at"] = datetime.now().isoformat()

        icon = "✅" if url else "  "
        label = url.split("/wiki/")[-1] if url else "None"
        label = urllib.parse.unquote(label)
        print(f"[{processed:>3}/{len(pending)}] {shikona:<14} {icon} {label}", flush=True)

        save_wiki_progress(wiki_entries)
        time.sleep(SLEEP_SEC)

    found = sum(1 for e in wiki_entries if e["status"] == "done")
    not_found = sum(1 for e in wiki_entries if e["status"] == "none")
    print(f"\n✅ Done: found={found}  not_found={not_found}")
    print(f"   Saved → {WIKI_OUT}")


if __name__ == "__main__":
    main()

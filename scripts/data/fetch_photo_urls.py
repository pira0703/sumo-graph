#!/usr/bin/env python3
"""
fetch_photo_urls.py  –  Phase 5-B: JSAプロフィールページから photo_url 一括取得

photo_url のパターン:
  https://www.sumo.or.jp/img/sumo_data/rikishi/270x474/XXXXXXXX.jpg
  ページ内の 270x474 サイズの最初の img タグが本人の写真（jsa_id とは別の8桁内部ID）
"""
from __future__ import annotations
import json, os, re, time, urllib.request, urllib.parse, urllib.error
from datetime import datetime
from typing import Optional

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROGRESS_IN  = os.path.join(SCRIPT_DIR, "rikishi_progress.json")
PHOTO_OUT    = os.path.join(SCRIPT_DIR, "photo_progress.json")

JSA_BASE    = "https://www.sumo.or.jp"
PROFILE_URL = JSA_BASE + "/ResultRikishiData/profile/{jsa_id}/"
HEADERS     = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
SLEEP_SEC   = 0.5   # JSA公式へのアクセス間隔


def fetch_photo_url(jsa_id: int, retry: int = 3) -> Optional[str]:
    """JSAプロフィールページから 270x474 の photo_url を取得"""
    url = PROFILE_URL.format(jsa_id=jsa_id)
    for attempt in range(retry):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=10) as res:
                html = res.read().decode("utf-8", errors="replace")
            # 270x474 サイズの最初の img タグを取得
            match = re.search(r'src="(/img/sumo_data/rikishi/270x474/[^"]+)"', html)
            if match:
                return JSA_BASE + match.group(1)
            return None
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 10 * (2 ** attempt)
                print(f"\n⚠️  429 Rate limit – waiting {wait}s...", flush=True)
                time.sleep(wait)
            else:
                return None
        except Exception as e:
            if attempt < retry - 1:
                time.sleep(2)
            else:
                return None
    return None


def load_progress() -> dict:
    if os.path.exists(PHOTO_OUT):
        with open(PHOTO_OUT, encoding="utf-8") as f:
            return {e["id"]: e for e in json.load(f)}
    return {}


def save_progress(entries: list):
    with open(PHOTO_OUT, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)


def main():
    with open(PROGRESS_IN, encoding="utf-8") as f:
        rikishi_list = json.load(f)

    progress_map = load_progress()

    # 進捗エントリ初期化
    entries = []
    for r in rikishi_list:
        if r["id"] in progress_map:
            entries.append(progress_map[r["id"]])
        else:
            entries.append({
                "id":         r["id"],
                "shikona":    r["shikona"],
                "jsa_id":     r["jsa_id"],
                "status":     "pending",
                "photo_url":  None,
                "fetched_at": None,
            })

    pending = [e for e in entries if e["status"] == "pending"]
    done    = sum(1 for e in entries if e["status"] == "done")
    none_   = sum(1 for e in entries if e["status"] == "none")

    print(f"📂 Loaded {len(entries)} wrestlers | pending={len(pending)}  done={done}  none={none_}")
    if not pending:
        print("✅ All done already.")
        return
    print(f"📷 Fetching photo_url for {len(pending)} wrestlers...\n")

    processed = 0
    for entry in entries:
        if entry["status"] != "pending":
            continue

        processed += 1
        jsa_id  = entry["jsa_id"]
        shikona = entry["shikona"]

        if jsa_id is None:
            entry["status"] = "none"
            entry["fetched_at"] = datetime.now().isoformat()
            print(f"[{processed:>3}/{len(pending)}] {shikona:<14}  ⚠️  jsa_id=None スキップ", flush=True)
            save_progress(entries)
            continue

        url = fetch_photo_url(jsa_id)
        entry["photo_url"]  = url
        entry["status"]     = "done" if url else "none"
        entry["fetched_at"] = datetime.now().isoformat()

        icon  = "✅" if url else "  "
        label = url.split("/")[-1] if url else "None"
        print(f"[{processed:>3}/{len(pending)}] {shikona:<14} {icon} {label}", flush=True)

        save_progress(entries)
        time.sleep(SLEEP_SEC)

    found     = sum(1 for e in entries if e["status"] == "done")
    not_found = sum(1 for e in entries if e["status"] == "none")
    print(f"\n✅ Done: found={found}  not_found={not_found}")
    print(f"   Saved → {PHOTO_OUT}")


if __name__ == "__main__":
    main()

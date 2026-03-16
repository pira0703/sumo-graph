#!/usr/bin/env python3
"""
fetch_profiles.py
JSAプロフィールページから力士のenriched dataを取得してrikishi_progress.jsonに逐次保存する。

使い方:
  python3 scripts/data/fetch_profiles.py [--batch 30]
"""

from __future__ import annotations
import json, re, time, argparse, urllib.request, urllib.error
from datetime import datetime
from pathlib import Path
from typing import Optional

PROGRESS_PATH = Path(__file__).parent / "rikishi_progress.json"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.sumo.or.jp/ResultRikishiData/search/",
}
BASE_PROFILE = "https://www.sumo.or.jp/ResultRikishiData/profile/{jsa_id}/"

ERA_BASE = {"明治": 1867, "大正": 1911, "昭和": 1925, "平成": 1988, "令和": 2018}
KANJI_NUM = {"〇":0,"一":1,"二":2,"三":3,"四":4,"五":5,"六":6,"七":7,"八":8,"九":9,"十":10}
MONTH_MAP = {"一月":"01","三月":"03","五月":"05","七月":"07","九月":"09","十一月":"11"}


def kanji_to_int(s: str) -> int:
    s = s.strip()
    if s.isdigit(): return int(s)
    if s == "元": return 1
    result = buf = 0
    for ch in s:
        if ch == "十":
            result += (buf if buf else 1) * 10
            buf = 0
        elif ch in KANJI_NUM:
            buf = KANJI_NUM[ch]
    return result + buf


def wareki_to_seireki(text: str) -> Optional[str]:
    """「平成11年5月22日（26歳）」→「1999-05-22」"""
    text = re.sub(r"（.*?）", "", text).strip()
    m = re.match(r"([明大昭平令]\w+)(\d+|[〇一二三四五六七八九十元]+)年"
                 r"(\d+|[〇一二三四五六七八九十元]+)月"
                 r"(\d+|[〇一二三四五六七八九十元]+)日", text)
    if not m: return None
    era, yr, mo, dy = m.group(1), m.group(2), m.group(3), m.group(4)
    base = ERA_BASE.get(era)
    if not base: return None
    return f"{base + kanji_to_int(yr):04d}-{kanji_to_int(mo):02d}-{kanji_to_int(dy):02d}"


def basho_to_id(text: str) -> Optional[str]:
    """「平成三十年一月場所」→「2018-01」"""
    text = text.replace("場所", "").strip()
    m = re.match(r"([明大昭平令]\w+)([〇一二三四五六七八九十元\d]+)年([一三五七九十]{1,3}月)", text)
    if not m: return None
    era, yr, mo_str = m.group(1), m.group(2), m.group(3)
    base = ERA_BASE.get(era)
    if not base: return None
    month = MONTH_MAP.get(mo_str)
    if not month: return None
    return f"{base + kanji_to_int(yr):04d}-{month}"


def normalize_born_place(text: str) -> str:
    text = text.strip()
    if "・" in text:
        return text.split("・")[0].strip()
    m = re.match(r"(北海道|.+?[都道府県])", text)
    return m.group(1) if m else text


def parse_profile(html: str) -> dict:
    result = {}
    rows = re.findall(r"<th[^>]*>(.*?)</th>\s*<td[^>]*>(.*?)</td>", html, re.DOTALL)
    kv = {}
    for th, td in rows:
        key = re.sub(r"<[^>]+>", "", th).strip()
        val = re.sub(r"<[^>]+>", " ", td).strip()
        kv[key] = re.sub(r"\s+", " ", val).strip()

    if "本名" in kv:   result["real_name"] = kv["本名"]
    if "生年月日" in kv: result["birth_date"] = wareki_to_seireki(kv["生年月日"])
    if "出身地" in kv:  result["born_place"] = normalize_born_place(kv["出身地"])
    if "初土俵" in kv:  result["active_from_basho"] = basho_to_id(kv["初土俵"])

    m = re.search(r'src="(https://www\.sumo\.or\.jp/img/sumo_data/rikishi/\d+x\d+/[^"]+)"', html)
    if m: result["photo_url"] = m.group(1)

    return result


def fetch_profile(jsa_id: int) -> Optional[dict]:
    url = BASE_PROFILE.format(jsa_id=jsa_id)
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8")
        return parse_profile(html)
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}", end="")
        return None
    except Exception as e:
        print(f"ERR:{e}", end="")
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=int, default=30)
    args = parser.parse_args()

    progress = json.loads(PROGRESS_PATH.read_text("utf-8"))
    pending = [e for e in progress if e.get("status") == "pending"]

    if not pending:
        print("✅ 全件処理済みです")
        return

    batch = pending[:args.batch]
    print(f"📋 Pending: {len(pending)} | Processing this batch: {len(batch)}\n")

    done_count = 0
    for i, entry in enumerate(batch, 1):
        jsa_id = entry.get("jsa_id")
        shikona = entry.get("shikona", "?")
        print(f"  [{i:3d}/{len(batch)}] {shikona:<12} (jsa_id={jsa_id})", end=" ... ", flush=True)

        if not jsa_id:
            entry["status"] = "skip"
            entry["fetched_at"] = datetime.now().isoformat()
            print("SKIP")
            continue

        data = fetch_profile(jsa_id)
        if data is None:
            entry["status"] = "error"
            entry["fetched_at"] = datetime.now().isoformat()
            print(" → ERROR")
        else:
            entry.update(data)
            entry["status"] = "done"
            entry["fetched_at"] = datetime.now().isoformat()
            done_count += 1
            print(f"OK  birth={data.get('birth_date')}  place={data.get('born_place')}")

        # 都度保存（セッション切れ耐性）
        PROGRESS_PATH.write_text(json.dumps(progress, ensure_ascii=False, indent=2), "utf-8")
        if i < len(batch):
            time.sleep(0.3)

    counts = {s: sum(1 for e in progress if e.get("status") == s)
              for s in ("pending", "done", "error", "skip")}
    print(f"\n✅ Batch done: {done_count}/{len(batch)} fetched")
    print(f"   pending={counts['pending']}  done={counts['done']}  "
          f"error={counts['error']}  skip={counts['skip']}")


if __name__ == "__main__":
    main()

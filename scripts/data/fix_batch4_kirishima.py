#!/usr/bin/env python3
"""
Batch 4 霧島 skip→done 修正スクリプト
正しいページ: 霧島鐵力（旧・霧馬山鐵雄）現役大関
"""

import json
from datetime import datetime, timezone

PROGRESS_PATH = "/Users/pipo/Documents/sumo-graph/scripts/data/wiki_episodes_progress.json"

with open(PROGRESS_PATH, encoding="utf-8") as f:
    data = json.load(f)

idx = {e["id"]: e for e in data}
now = datetime.now(timezone.utc).isoformat()


def up(id_, episodes=None, birth_date=None, active_from_basho=None,
       high_school=None, university=None):
    e = idx[id_]
    if episodes is not None:
        e["episodes"] = episodes
    if birth_date is not None:
        e["birth_date"] = birth_date
    if active_from_basho is not None:
        e["active_from_basho"] = active_from_basho
    if high_school is not None:
        e["high_school"] = high_school
    if university is not None:
        e["university"] = university
    e["status"] = "done"
    e["fetched_at"] = now


# 霧島鐵力（334920a8）- 旧・霧馬山鐵雄、現役大関、音羽山部屋（入門時は陸奥部屋）
# 生年月日: 1996年4月24日 / モンゴル国ドルノド県出身 / 初土俵: 2015年5月場所
up(
    "334920a8-bfa9-40ea-85aa-e1da785fd8ce",
    birth_date="1996-04-24",
    active_from_basho="2015-05",
    episodes=(
        "モンゴル国ドルノド県出身。遊牧民の家庭に育ち、幼少期から乗馬・水くみで"
        "自然と足腰を鍛えた。2014年、知人の誘いで「何となく」訪日して陸奥部屋の"
        "体験入門に参加。5人の中で最もセンスを認められ、師匠・陸奥（元横綱・霧島一博）"
        "から「関取になるまでモンゴルに帰るな」と命じられて入門を決意し、2015年5月場所"
        "で初土俵。四股名「霧馬山」の「霧」は師匠の四股名から授かり、師弟の絆が名前に"
        "宿った。部屋の横綱・鶴竜からは直接食事指導を受けて体作りを徹底し、2023年3月"
        "場所で初優勝、同年大関昇進後に四股名を霧島と改めた。"
    )
)

# 書き戻し
with open(PROGRESS_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

# 確認
batch4 = [e for e in data if e.get("batch") == 4]
done = [e for e in batch4 if e.get("status") == "done"]
skip = [e for e in batch4 if e.get("status") == "skip"]
print(f"Batch 4: done={len(done)}, skip={len(skip)}")
for e in done:
    print(f"  ✅ {e['shikona']:10s} {e.get('birth_date','')} {e.get('active_from_basho','')}")
for e in skip:
    print(f"  ⏭️  {e['shikona']:10s} SKIP")

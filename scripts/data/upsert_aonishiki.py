#!/usr/bin/env python3
"""安青錦新大を Supabase に直接 UPSERT するスクリプト。
progress.json 対象外のため REST API で直接 UPDATE する。
"""
import os, json, urllib.request, urllib.error

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

UUID = "eb1d9b1a-cb46-4763-9b2a-02c5c148793b"

episodes = (
    "ウクライナ・ヴィーンヌィツャ出身。7歳から相撲を始め、2022年2月のロシア侵攻を機に"
    "相撲環境を求めて来日。報徳学園相撲部監督の紹介で安治川親方（元関脇・安美錦）と出会い、"
    "2022年12月に研修生となった。四股名「安青錦」の「安」と「錦」は師匠の現役時代の四股名"
    "「安美錦」から、「青」はウクライナ国旗と自身の目の色を表し、「新大」は居候先だった"
    "関西大学相撲部主将・山中新大から授かった。師弟と恩人の名が四股名に宿る絆の証しである。"
    "2023年9月場所で初土俵を踏み、初土俵から14場所で大関昇進という年6場所制以降史上最速の"
    "昇進を達成。目標とする若隆景から直接指導を受けるなど、縁を力に変えながら土俵を駆け上がっている。"
)

payload = {
    "episodes": episodes,
    "birth_date": "2004-03-23",
    "active_from_basho": "2023-09",
    "high_school": None,
    "university": None,
    "wiki_url": "https://ja.wikipedia.org/wiki/%E5%AE%89%E9%9D%92%E9%8C%A6%E6%96%B0%E5%A4%A7",
}

url = f"{SUPABASE_URL}/rest/v1/rikishi?id=eq.{UUID}"
data = json.dumps(payload).encode("utf-8")

req = urllib.request.Request(
    url,
    data=data,
    method="PATCH",
    headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    },
)

try:
    with urllib.request.urlopen(req) as res:
        body = res.read().decode()
        result = json.loads(body)
        if result:
            r = result[0]
            print(f"✅ UPSERT 成功: {r['shikona']} ({r['id']})")
            print(f"   birth_date       : {r.get('birth_date')}")
            print(f"   active_from_basho: {r.get('active_from_basho')}")
            print(f"   wiki_url         : {r.get('wiki_url')}")
            print(f"   episodes[:50]    : {(r.get('episodes') or '')[:50]}…")
        else:
            print("⚠️  レスポンスが空 (UUID 不一致の可能性)")
except urllib.error.HTTPError as e:
    print(f"❌ HTTP {e.code}: {e.read().decode()}")

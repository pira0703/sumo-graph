#!/usr/bin/env python3
"""
JSA力士検索ページから全力士のname→jsa_idマッピングを取得するスクリプト
HTML構造: <a href="/ResultRikishiData/profile/{id}/"><span class="fnt16 fntB">{shikona}</span><br>({yomigana})</a>
ページパラメーター: p=1..12, v=50 (件数), kakuzuke_id=0 (全て)
"""
import urllib.request, urllib.parse, json, re, time

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.sumo.or.jp/ResultRikishiData/search/',
}
BASE_URL = 'https://www.sumo.or.jp/ResultRikishiData/search/'
OUTPUT   = '/Users/pipo/Documents/sumo-graph/scripts/data/rikishi_jsa_mapping.json'

PATTERN = re.compile(
    r'href="/ResultRikishiData/profile/(\d+)/"\s*>'
    r'<span[^>]*>([^<]+)</span>'
    r'<br>\(([^)]+)\)'
)

def fetch_page(page_num: int) -> list[dict]:
    post_data = urllib.parse.urlencode({
        'p': str(page_num),
        'v': '50',
        'kakuzuke_id': '0',
        'pref_id': '',
        'name': '',
    }).encode('utf-8')
    req = urllib.request.Request(BASE_URL, data=post_data, headers=HEADERS, method='POST')
    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode('utf-8')

    entries = []
    for jsa_id_str, shikona, yomigana in PATTERN.findall(html):
        entries.append({
            'jsa_id': int(jsa_id_str),
            'shikona': shikona.strip(),
            'yomigana': yomigana.strip(),
        })
    return entries

def main():
    all_data = []
    total_pages = 12
    seen_ids = set()

    for page in range(1, total_pages + 1):
        entries = fetch_page(page)
        new_entries = [e for e in entries if e['jsa_id'] not in seen_ids]
        for e in new_entries:
            seen_ids.add(e['jsa_id'])
        all_data.extend(new_entries)
        print(f'  Page {page:2d}: +{len(new_entries):3d} new entries (total: {len(all_data)})')
        if page < total_pages:
            time.sleep(0.5)

    print(f'\n✅ Total: {len(all_data)} unique records')

    output = {
        '_meta': {
            'created_at': '2026-03-14',
            'description': 'JSA力士検索ページから取得したname→jsa_idマッピング',
            'source': BASE_URL,
            'total_pages': total_pages,
            'last_page_fetched': total_pages,
            'total_records': len(all_data),
        },
        'data': all_data,
    }

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f'📁 Saved to: {OUTPUT}')

if __name__ == '__main__':
    main()

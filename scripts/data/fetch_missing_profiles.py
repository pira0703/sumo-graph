#!/usr/bin/env python3
"""
fetch_missing_profiles.py
birth_date / active_from_basho が欠損している力士のデータを
JSAプロフィールページから再取得する。

出力: scripts/data/missing_profiles_progress.json

【アンチハルシネーション原則】
- データソース: JSA公式のみ (https://www.sumo.or.jp/)
- 推測・補完は一切しない（取得できなければ null のまま）
- UPSERT前に dry_run で件数・サンプルを確認すること
"""

import json
import re
import time
import urllib.request
from datetime import datetime
from html.parser import HTMLParser
import os

# --- 設定 ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROGRESS_FILE = os.path.join(SCRIPT_DIR, 'missing_profiles_progress.json')
SOURCE_FILE   = os.path.join(SCRIPT_DIR, 'rikishi_progress.json')
JSA_PROFILE_URL = 'https://www.sumo.or.jp/ResultRikishiData/profile/{jsa_id}/'
SLEEP_SEC = 0.5  # サーバー負荷対策

# --- 和暦変換 ---
ERA_BASE = {'昭和': 1925, '平成': 1988, '令和': 2018}
KANJI_DIGITS = {'〇':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'元':1}
MONTH_KANJI = {'一': '01', '三': '03', '五': '05', '七': '07', '九': '09', '十一': '11'}

def kanji_to_int(s: str) -> int:
    """漢数字文字列を整数に変換。例: 十六→16, 二十三→23, 元→1"""
    s = s.strip()
    if not s:
        return 0
    if s == '元':  # 元年 → 1年
        return 1
    if '十' in s:
        parts = s.split('十', 1)
        tens = KANJI_DIGITS.get(parts[0], 1) if parts[0] else 1
        ones = KANJI_DIGITS.get(parts[1], 0) if parts[1] else 0
        return tens * 10 + ones
    else:
        return sum(KANJI_DIGITS.get(c, 0) for c in s)

def parse_birth_date(s: str):
    """
    和暦生年月日 → ISO date文字列 or None
    例: 昭和59年11月16日（41歳）→ 1984-11-16
        平成13年11月12日（24歳）→ 2001-11-12
    ※ JSAサイトは生年月日を算用数字で表記
    """
    # 元年対応: 昭和元年 → 昭和1年 に正規化
    s = re.sub(r'([昭平令][和成和])元年', lambda x: x.group(1) + '1年', s)
    m = re.search(r'([昭平令][和成和])(\d+)年(\d+)月(\d+)日', s)
    if not m:
        return None
    era = m.group(1)
    if era not in ERA_BASE:
        return None
    year  = ERA_BASE[era] + int(m.group(2))
    month = int(m.group(3))
    day   = int(m.group(4))
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return None
    return f'{year:04d}-{month:02d}-{day:02d}'

def parse_debut_basho(s: str):
    """
    和暦場所名 → 場所ID (YYYY-MM) or None
    例: 平成十六年一月場所  → 2004-01
        令和六年七月場所    → 2024-07
        昭和六十二年三月場所 → 1987-03
    ※ JSAサイトは初土俵を漢数字で表記
    """
    # 月は一/三/五/七/九/十一 の6種のみ
    # 元年 を 一年 に正規化してから処理
    s2 = re.sub(r'([昭平令][和成和])元年', lambda x: x.group(1) + '一年', s)
    m = re.search(r'([昭平令][和成和])([〇一二三四五六七八九十]+)年(十一|[一三五七九])月(?:技量審査)?場所', s2)
    if not m:
        return None
    era        = m.group(1)
    year_kanji = m.group(2)
    month_k    = m.group(3)
    if era not in ERA_BASE:
        return None
    year  = ERA_BASE[era] + kanji_to_int(year_kanji)
    month = MONTH_KANJI.get(month_k)
    if not month:
        return None
    return f'{year:04d}-{month}'

# --- プロフィールHTMLパーサー ---
class ProfileParser(HTMLParser):
    """<th>キー</th><td>値</td> のペアを抽出"""
    def __init__(self):
        super().__init__()
        self.in_th   = False
        self.in_td   = False
        self.cur_th  = ''
        self.last_th = ''
        self.td_buf  = ''
        self.pairs   = []

    def handle_starttag(self, tag, attrs):
        if tag == 'th': self.in_th = True;  self.cur_th = ''
        if tag == 'td': self.in_td = True;  self.td_buf = ''

    def handle_endtag(self, tag):
        if tag == 'th':
            self.in_th   = False
            self.last_th = self.cur_th
        if tag == 'td':
            self.in_td = False
            if self.last_th:
                self.pairs.append((self.last_th, self.td_buf.strip()))
                self.last_th = ''

    def handle_data(self, data):
        if self.in_th: self.cur_th  += data.strip()
        if self.in_td: self.td_buf  += data.strip()

def fetch_profile(jsa_id: int):
    """
    JSAプロフィールページから birth_date, active_from_basho を取得。
    戻り値: (birth_date, active_from_basho, error_msg)
    """
    url = JSA_PROFILE_URL.format(jsa_id=jsa_id)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible)'})
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            html = res.read().decode('utf-8', errors='replace')
    except Exception as e:
        return None, None, str(e)

    parser = ProfileParser()
    parser.feed(html)

    birth_date        = None
    active_from_basho = None
    for key, val in parser.pairs:
        if key == '生年月日' and val and birth_date is None:
            birth_date = parse_birth_date(val)
        if key == '初土俵' and val and active_from_basho is None:
            active_from_basho = parse_debut_basho(val)

    return birth_date, active_from_basho, None

# --- メイン ---
def main():
    # ①ソースファイル読み込み
    with open(SOURCE_FILE, 'r', encoding='utf-8') as f:
        source = json.load(f)

    no_birth  = sum(1 for r in source if not r.get('birth_date'))
    no_debut  = sum(1 for r in source if not r.get('active_from_basho'))
    targets   = [r for r in source if not r.get('birth_date') or not r.get('active_from_basho')]
    print(f'ソース総数: {len(source)}名')
    print(f'  birth_date 欠損:        {no_birth}名')
    print(f'  active_from_basho 欠損: {no_debut}名')
    print(f'  処理対象（いずれかが欠損）: {len(targets)}名')
    print()

    # ②進捗ファイル: 存在すれば再開、なければ初期化
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            progress = json.load(f)
        progress_map = {p['jsa_id']: p for p in progress}
        # 新規 target が増えていれば追加
        added = 0
        for r in targets:
            if r['jsa_id'] not in progress_map:
                entry = _make_entry(r)
                progress.append(entry)
                progress_map[r['jsa_id']] = entry
                added += 1
        if added:
            print(f'新規追加: {added}件')
        print(f'進捗ファイル読み込み完了: {len(progress)}件')
    else:
        progress = [_make_entry(r) for r in targets]
        progress_map = {p['jsa_id']: p for p in progress}
        with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
            json.dump(progress, f, ensure_ascii=False, indent=2)
        print(f'進捗ファイル初期化: {len(progress)}件')

    # ③ステータス確認
    pending = [p for p in progress if p['status'] == 'pending']
    done    = [p for p in progress if p['status'] == 'done']
    errors  = [p for p in progress if p['status'] == 'error']
    print(f'pending: {len(pending)} / done: {len(done)} / error: {len(errors)}')
    print()

    if not pending:
        print('全件完了済みです。')
        _print_summary(progress)
        return

    # ④フェッチ処理
    done_count = len(done)
    for i, entry in enumerate(pending):
        jsa_id  = entry['jsa_id']
        shikona = entry['shikona']
        num     = done_count + i + 1
        print(f'[{num}/{len(progress)}] {shikona} (jsa_id={jsa_id}) ...', end='', flush=True)

        birth_date, active_from_basho, error = fetch_profile(jsa_id)

        if error:
            entry['status'] = 'error'
            entry['error']  = error
            print(f' ❌ {error}')
        else:
            entry['status']            = 'done'
            entry['birth_date']        = birth_date
            entry['active_from_basho'] = active_from_basho
            entry['fetched_at']        = datetime.now().isoformat()
            parts = []
            if entry['needs_birth_date']:
                parts.append(f'birth={birth_date or "NULL"}')
            if entry['needs_debut']:
                parts.append(f'debut={active_from_basho or "NULL"}')
            print(f' ✅ {", ".join(parts)}')

        # 20件ごとに進捗保存
        if (i + 1) % 20 == 0:
            _save(progress)
            print(f'  → 中間保存 ({num}件処理済み)')

        time.sleep(SLEEP_SEC)

    # ⑤最終保存
    _save(progress)
    print()
    _print_summary(progress)

def _make_entry(r: dict) -> dict:
    return {
        'id':               r['id'],
        'shikona':          r['shikona'],
        'jsa_id':           r['jsa_id'],
        'status':           'pending',
        'needs_birth_date': not bool(r.get('birth_date')),
        'needs_debut':      not bool(r.get('active_from_basho')),
        'birth_date':       None,
        'active_from_basho': None,
        'error':            None,
        'fetched_at':       None,
    }

def _save(progress: list):
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)

def _print_summary(progress: list):
    done   = [p for p in progress if p['status'] == 'done']
    errors = [p for p in progress if p['status'] == 'error']
    got_birth = sum(1 for p in done if p.get('birth_date'))
    got_debut = sum(1 for p in done if p.get('active_from_basho'))
    null_birth = sum(1 for p in done if p['needs_birth_date'] and not p.get('birth_date'))
    null_debut = sum(1 for p in done if p['needs_debut'] and not p.get('active_from_basho'))
    print('=== サマリー ===')
    print(f'完了:     {len(done)} / {len(progress)}')
    print(f'エラー:   {len(errors)}件')
    print(f'birth_date 取得:        {got_birth}件 (NULLのまま: {null_birth}件)')
    print(f'active_from_basho 取得: {got_debut}件 (NULLのまま: {null_debut}件)')
    if errors:
        print()
        print('エラー一覧（最大5件）:')
        for e in errors[:5]:
            print(f'  {e["shikona"]} jsa_id={e["jsa_id"]}: {e["error"]}')

if __name__ == '__main__':
    main()

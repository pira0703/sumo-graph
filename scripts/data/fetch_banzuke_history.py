#!/usr/bin/env python3
"""
fetch_banzuke_history.py

現役力士のJSAプロフィールページから関取歴（幕内+十両）を取得する。

出力: scripts/data/banzuke_history_progress.json
  - 力士ごとに banzuke_records リストを持つ
  - {basho, rank_class, rank_number, rank_side, rank_display}

【アンチハルシネーション原則】
- データソース: JSA公式のみ (https://www.sumo.or.jp/)
- ew_profile_sm テーブルから取得（幕内+十両のみ表示）
- 推測・補完は一切しない
- UPSERT前に DRY_RUN で件数・サンプルを確認すること
"""

import json
import re
import time
import urllib.request
from datetime import datetime
from html.parser import HTMLParser
import os

# --- 設定 ---
SCRIPT_DIR    = os.path.dirname(os.path.abspath(__file__))
PROGRESS_FILE = os.path.join(SCRIPT_DIR, 'banzuke_history_progress.json')
SOURCE_FILE   = os.path.join(SCRIPT_DIR, 'rikishi_progress.json')
JSA_PROFILE_URL = 'https://www.sumo.or.jp/ResultRikishiData/profile/{jsa_id}/'
SLEEP_SEC = 0.5  # サーバー負荷対策

# --- 和暦変換 ---
ERA_BASE = {'昭和': 1925, '平成': 1988, '令和': 2018}
KANJI_DIGITS = {
    '〇': 0, '一': 1, '二': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '元': 1,
}
MONTH_KANJI = {
    '一': '01', '三': '03', '五': '05',
    '七': '07', '九': '09', '十一': '11',
}

def kanji_to_int(s: str) -> int:
    """漢数字文字列を整数に変換。十六→16, 二十三→23, 元→1"""
    s = s.strip()
    if not s:
        return 0
    if s == '元':
        return 1
    if '十' in s:
        parts = s.split('十', 1)
        tens = KANJI_DIGITS.get(parts[0], 1) if parts[0] else 1
        ones = KANJI_DIGITS.get(parts[1], 0) if parts[1] else 0
        return tens * 10 + ones
    else:
        return sum(KANJI_DIGITS.get(c, 0) for c in s)

def parse_basho(s: str):
    """
    漢字表記の場所名 → 場所ID (YYYY-MM)
    例: 令和八年三月場所   → '2026-03'
        平成十六年一月場所 → '2004-01'
        平成二十三年五月技量審査場所 → '2011-05'
    """
    # 元年 → 一年 に正規化
    s2 = re.sub(r'([昭平令][和成和])元年', lambda x: x.group(1) + '一年', s)
    m = re.search(
        r'([昭平令][和成和])([〇一二三四五六七八九十]+)年(十一|[一三五七九])月(?:技量審査)?場所',
        s2
    )
    if not m:
        return None
    era        = m.group(1)
    year_kanji = m.group(2)
    month_k    = m.group(3)
    if era not in ERA_BASE:
        return None
    year  = ERA_BASE[era] + kanji_to_int(year_kanji)
    month = MONTH_KANJI.get(month_k)
    return f'{year:04d}-{month}' if month else None

# --- 番付パーサー ---
# 処理対象は関取（幕内+十両）のみ。幕下以下は None を返す。
RANK_CLASS_MAP = [
    ('横綱', 'yokozuna',   'Y'),
    ('大関', 'ozeki',      'O'),
    ('関脇', 'sekiwake',   'S'),
    ('小結', 'komusubi',   'K'),
    ('前頭', 'maegashira', 'M'),
    ('十両', 'juryo',      'J'),
]
SIDE_MAP = {'東': 'east', '西': 'west'}

def parse_rank(rank_text: str):
    """
    番付文字列をパース。関取以外（幕下以下）は None を返す。

    戻り値: {rank_class, rank_number, rank_side, rank_display}

    例:
      '西前頭九枚目'  → maegashira, 9, west, 'M9w'
      '東前頭筆頭'    → maegashira, 1, east, 'M1e'
      '東横綱'        → yokozuna,   None, east, 'Ye'
      '東横綱一'      → yokozuna,   1,    east, 'Y1e'
      '西十両三枚目'  → juryo,      3,    west, 'J3w'
    """
    t = rank_text.strip()
    if not t:
        return None

    # 東/西 (side)
    side = None
    if t[0] in SIDE_MAP:
        side = SIDE_MAP[t[0]]
        t = t[1:]
    else:
        return None  # 東西不明はスキップ

    # 番付 (rank_class)
    rank_class = None
    prefix     = None
    for jp, en, abbr in RANK_CLASS_MAP:
        if t.startswith(jp):
            rank_class = en
            prefix     = abbr
            t = t[len(jp):]
            break

    if rank_class is None:
        return None  # 幕下以下 or 不明 → スキップ

    # 枚数 (rank_number)
    # 前頭: 筆頭/二/三〜十七 (枚目なし)
    # 十両: 筆頭/二枚目〜十四枚目
    # 横綱/大関/関脇/小結: 一/二/三... or なし
    num_text = t.replace('枚目', '').strip()
    rank_number = None
    if num_text == '筆頭':
        rank_number = 1
    elif num_text:
        n = kanji_to_int(num_text)
        rank_number = n if n > 0 else None

    # rank_display
    side_char = 'e' if side == 'east' else 'w'
    if rank_number is not None:
        rank_display = f'{prefix}{rank_number}{side_char}'
    else:
        rank_display = f'{prefix}{side_char}'

    return {
        'rank_class':   rank_class,
        'rank_number':  rank_number,
        'rank_side':    side,
        'rank_display': rank_display,
    }

# --- ew_profile_sm HTMLパーサー ---
class BanzukeHistoryParser(HTMLParser):
    """
    JSAプロフィールページの ew_profile_sm テーブルをパース。
    各 <tr> の左 <td> から:
      spans[0] = 場所名（令和八年三月場所）
      spans[1] = 番付（西前頭九枚目）
      spans[2] = 四股名（玉鷲 一朗）
    を取得する。
    """
    def __init__(self):
        super().__init__()
        self._in_target  = False   # ew_profile_sm テーブル内か
        self._table_depth = 0      # ネストされた table の深さ管理
        self._in_td      = False
        self._in_span    = False
        self._span_buf   = ''
        self._td_spans   = []      # 現在の <td> 内のスパン群
        self._tr_tds     = []      # 現在の <tr> 内の <td> 群（spans のリスト）
        self.rows        = []      # 全行: [[(span...), ...], ...]

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == 'table':
            if attrs_dict.get('id') == 'ew_profile_sm':
                self._in_target   = True
                self._table_depth = 1
            elif self._in_target:
                self._table_depth += 1
            return
        if not self._in_target:
            return
        if tag == 'tr':
            self._tr_tds = []
        elif tag == 'td':
            self._in_td    = True
            self._td_spans = []
        elif tag == 'span' and self._in_td:
            self._in_span  = True
            self._span_buf = ''

    def handle_endtag(self, tag):
        if tag == 'table' and self._in_target:
            self._table_depth -= 1
            if self._table_depth == 0:
                self._in_target = False
            return
        if not self._in_target:
            return
        if tag == 'tr':
            if self._tr_tds:
                self.rows.append(self._tr_tds[:])
            self._tr_tds = []
        elif tag == 'td':
            self._in_td = False
            self._tr_tds.append(self._td_spans[:])
            self._td_spans = []
        elif tag == 'span' and self._in_span:
            self._in_span = False
            val = self._span_buf.strip().replace('\xa0', ' ').strip()
            self._td_spans.append(val)
            self._span_buf = ''

    def handle_data(self, data):
        if self._in_target and self._in_span:
            self._span_buf += data


def parse_banzuke_history(html: str) -> list:
    """
    HTMLから ew_profile_sm の関取歴レコードを抽出。
    幕内+十両のみ。幕下以下は rank パース時に None → スキップ。
    戻り値: [{basho, rank_class, rank_number, rank_side, rank_display}, ...]
    """
    parser = BanzukeHistoryParser()
    parser.feed(html)

    records = []
    for tr_tds in parser.rows:
        if not tr_tds or len(tr_tds) < 1:
            continue
        left_spans = tr_tds[0]
        if len(left_spans) < 2:
            continue

        basho_text = left_spans[0]   # 例: 令和八年三月場所
        rank_text  = left_spans[1]   # 例: 西前頭九枚目

        basho = parse_basho(basho_text)
        if not basho:
            continue

        rank_info = parse_rank(rank_text)
        if not rank_info:
            continue  # 幕下以下はスキップ

        records.append({'basho': basho, **rank_info})

    return records


def fetch_banzuke_history(jsa_id: int):
    """JSAプロフィールページからew_profile_smの関取歴を取得。"""
    url = JSA_PROFILE_URL.format(jsa_id=jsa_id)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible)'})
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            html = res.read().decode('utf-8', errors='replace')
    except Exception as e:
        return None, str(e)
    records = parse_banzuke_history(html)
    return records, None


# --- メイン ---
def main():
    # ① ソースファイル読み込み
    with open(SOURCE_FILE, 'r', encoding='utf-8') as f:
        source = json.load(f)

    targets = [r for r in source if r.get('jsa_id')]
    print(f'ソース総数: {len(source)}名')
    print(f'jsa_idあり（対象）: {len(targets)}名')
    print()

    # ② 進捗ファイル: 存在すれば再開、なければ初期化
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            progress = json.load(f)
        progress_map = {p['jsa_id']: p for p in progress}
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

    # ③ ステータス確認
    pending = [p for p in progress if p['status'] == 'pending']
    done    = [p for p in progress if p['status'] == 'done']
    errors  = [p for p in progress if p['status'] == 'error']
    print(f'pending: {len(pending)} / done: {len(done)} / error: {len(errors)}')
    print()

    if not pending:
        print('全件完了済みです。')
        _print_summary(progress)
        return

    # ④ フェッチ処理
    done_count = len(done)
    for i, entry in enumerate(pending):
        jsa_id  = entry['jsa_id']
        shikona = entry['shikona']
        num     = done_count + i + 1
        print(f'[{num}/{len(progress)}] {shikona} (jsa_id={jsa_id}) ...', end='', flush=True)

        records, error = fetch_banzuke_history(jsa_id)

        if error:
            entry['status'] = 'error'
            entry['error']  = error
            print(f' ❌ {error}')
        else:
            entry['status']          = 'done'
            entry['banzuke_records'] = records
            entry['fetched_at']      = datetime.now().isoformat()
            count = len(records)
            if count > 0:
                # 最新の関取番付を表示
                latest = records[0]
                print(f' ✅ {count}場所 (最新: {latest["basho"]} {latest["rank_display"]})')
            else:
                print(f' ✅ 関取歴なし')

        # 20件ごとに中間保存
        if (i + 1) % 20 == 0:
            _save(progress)
            print(f'  → 中間保存 ({num}件処理済み)')

        time.sleep(SLEEP_SEC)

    # ⑤ 最終保存
    _save(progress)
    print()
    _print_summary(progress)


def _make_entry(r: dict) -> dict:
    return {
        'rikishi_id':     r['id'],
        'jsa_id':         r['jsa_id'],
        'shikona':        r['shikona'],
        'status':         'pending',
        'banzuke_records': [],
        'error':          None,
        'fetched_at':     None,
    }

def _save(progress: list):
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)

def _print_summary(progress: list):
    done   = [p for p in progress if p['status'] == 'done']
    errors = [p for p in progress if p['status'] == 'error']
    total_records = sum(len(p.get('banzuke_records', [])) for p in done)
    no_sekitori   = sum(1 for p in done if not p.get('banzuke_records'))
    print('=== サマリー ===')
    print(f'完了:          {len(done)} / {len(progress)}')
    print(f'エラー:        {len(errors)}件')
    print(f'関取歴なし:    {no_sekitori}件')
    print(f'合計番付レコード: {total_records}件')
    if errors:
        print()
        print('エラー一覧（最大5件）:')
        for e in errors[:5]:
            print(f'  {e["shikona"]} jsa_id={e["jsa_id"]}: {e["error"]}')
    if done:
        # サンプル表示（関取歴ありの最初の3名）
        samples = [p for p in done if p.get('banzuke_records')][:3]
        if samples:
            print()
            print('サンプル確認（最初の3名）:')
            for p in samples:
                recs = p['banzuke_records']
                print(f'  {p["shikona"]}: {len(recs)}場所')
                for r in recs[:3]:
                    print(f'    {r["basho"]} {r["rank_display"]}')
                if len(recs) > 3:
                    print(f'    ... 他{len(recs)-3}場所')


if __name__ == '__main__':
    main()

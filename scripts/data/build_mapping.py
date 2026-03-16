#!/usr/bin/env python3
"""
localStorage から取得したJSAデータをJSONファイルに変換するスクリプト
"""
import json, sys

# このスクリプトはstdinからJSONデータを受け取って整形して書き出す
data = json.load(sys.stdin)
output_path = '/Users/pipo/Documents/sumo-graph/scripts/data/rikishi_jsa_mapping.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print(f"Written {data['_meta']['total_records']} records to {output_path}")

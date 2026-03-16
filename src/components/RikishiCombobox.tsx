"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// /api/rikishi?q= が返す型（最小限）
interface RikishiOption {
  id:           string;
  shikona:      string;
  yomigana:     string | null;
  highest_rank: string | null;
  status: string;
  retirement_basho: string | null;
  heya:         { name: string } | null;
}

interface Props {
  /** 現在選択中の力士ID */
  value: string | null;
  /** 選択変更時のコールバック */
  onChange: (id: string | null, rikishi: RikishiOption | null) => void;
  /** プレースホルダー */
  placeholder?: string;
  /** 空欄ラベル（「未配置」など） */
  emptyLabel?: string;
}

/**
 * 力士フィルタラブルコンボボックス
 * - /api/rikishi?q= でインクリメンタル検索
 * - 現役優先（status=active が上位）
 */
export default function RikishiCombobox({
  value,
  onChange,
  placeholder = "力士名を入力",
  emptyLabel = "（未配置）",
}: Props) {
  const [inputValue, setInputValue] = useState("");
  const [options, setOptions]     = useState<RikishiOption[]>([]);
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 外クリックで閉じる
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // 選択確定していない場合は元のラベルに戻す
        if (value) {
          const found = options.find(o => o.id === value);
          if (found) setInputValue(found.shikona);
        } else {
          setInputValue("");
        }
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [value, options]);

  // value が外部から変わったとき inputValue を同期
  useEffect(() => {
    if (!value) {
      setInputValue("");
      return;
    }
    // すでに options に載っていれば即反映
    const found = options.find(o => o.id === value);
    if (found) {
      setInputValue(found.shikona);
    } else {
      // API で取ってくる
      fetch(`/api/rikishi/${value}`)
        .then(r => r.json())
        .then(d => {
          if (d.rikishi?.shikona) setInputValue(d.rikishi.shikona);
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const search = useCallback((q: string) => {
    setLoading(true);
    fetch(`/api/rikishi?q=${encodeURIComponent(q)}&limit=30`)
      .then(r => r.json())
      .then((data: RikishiOption[]) => {
        // 現役（status=active）を先頭に
        const sorted = [...data].sort((a, b) => {
          if ((a.status === 'active') !== (b.status === 'active'))
            return a.status === 'active' ? -1 : 1;
          return 0;
        });
        setOptions(sorted);
        setOpen(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setInputValue(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 200);
  }

  function handleFocus() {
    if (options.length === 0 && !loading) {
      search(inputValue);
    } else {
      setOpen(true);
    }
  }

  function select(rikishi: RikishiOption | null) {
    if (!rikishi) {
      setInputValue("");
      onChange(null, null);
    } else {
      setInputValue(rikishi.shikona);
      onChange(rikishi.id, rikishi);
    }
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setInputValue("");
    onChange(null, null);
    setOpen(false);
  }

  const filtered = options.filter(o =>
    o.shikona.includes(inputValue) ||
    (o.yomigana ?? "").includes(inputValue) ||
    inputValue === ""
  );

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          className="w-full bg-stone-900 border border-stone-700 rounded px-2 py-1.5 text-sm text-white
            placeholder:text-stone-500 focus:outline-none focus:border-amber-500 pr-7"
          value={inputValue}
          placeholder={placeholder}
          onChange={handleInputChange}
          onFocus={handleFocus}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 text-xs leading-none"
            title="クリア"
          >
            ✕
          </button>
        )}
        {loading && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 text-xs">…</span>
        )}
      </div>

      {open && (
        <ul className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto
          bg-stone-800 border border-stone-600 rounded shadow-xl text-sm">
          {/* 未配置 */}
          <li
            className="px-3 py-2 cursor-pointer text-stone-400 hover:bg-stone-700 border-b border-stone-700"
            onMouseDown={() => select(null)}
          >
            {emptyLabel}
          </li>

          {filtered.length === 0 && !loading && (
            <li className="px-3 py-2 text-stone-500">候補なし</li>
          )}

          {filtered.map(o => (
            <li
              key={o.id}
              onMouseDown={() => select(o)}
              className={`px-3 py-2 cursor-pointer hover:bg-stone-700 flex items-center justify-between gap-2
                ${o.id === value ? "bg-stone-700 text-amber-300" : "text-stone-100"}`}
            >
              <span className="font-medium">{o.shikona}</span>
              <span className="text-xs text-stone-500 shrink-0">
                {o.status === "retired" ? `引退${o.retirement_basho ? `(${o.retirement_basho})` : ""}` : "現役"}
                {o.heya ? ` · ${o.heya.name}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useState, useRef, useCallback } from "react";

// /api/rikishi が返す型（最小限）
interface RikishiOption {
  id:           string;
  shikona:      string;
  yomigana:     string | null;
  highest_rank: string | null;
  status: string;
  heya:         { name: string } | null;
}

interface Props {
  /** 力士が選択されたときのコールバック */
  onSelect: (id: string, rikishi: RikishiOption) => void;
}

/**
 * グラフ上フローティング検索ボックス
 * - /api/rikishi?q= でインクリメンタル検索
 * - 選択後に入力欄をクリア（再検索しやすいように）
 * - 現役優先表示
 */
export default function GraphSearch({ onSelect }: Props) {
  const [inputValue, setInputValue] = useState("");
  const [options,    setOptions]    = useState<RikishiOption[]>([]);
  const [open,       setOpen]       = useState(false);
  const [loading,    setLoading]    = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    if (!q.trim()) {
      setOptions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    fetch(`/api/rikishi?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then((data: RikishiOption[]) => {
        // 現役優先
        const sorted = [...data].sort((a, b) => {
          if ((a.status === 'active') !== (b.status === 'active'))
            return a.status === 'active' ? -1 : 1;
          return 0;
        });
        setOptions(sorted.slice(0, 20));
        setOpen(sorted.length > 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setInputValue(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setOptions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => search(q), 200);
  }

  function handleFocus() {
    if (inputValue.trim()) {
      if (options.length > 0) setOpen(true);
      else search(inputValue);
    }
  }

  function handleBlur() {
    // mousedown イベントの後に閉じる（クリック処理が先に走るように）
    setTimeout(() => setOpen(false), 150);
  }

  function select(rikishi: RikishiOption) {
    onSelect(rikishi.id, rikishi);
    setInputValue("");
    setOptions([]);
    setOpen(false);
  }

  return (
    <div className="relative w-52">
      {/* 入力欄 */}
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none select-none">
          🔍
        </span>
        <input
          type="text"
          className="w-full bg-stone-900/90 border border-stone-700 rounded-lg pl-8 pr-3 py-1.5
            text-sm text-white placeholder:text-stone-500
            focus:outline-none focus:border-amber-500
            backdrop-blur-sm shadow-lg"
          value={inputValue}
          placeholder="力士を検索..."
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {loading && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 text-xs">
            …
          </span>
        )}
      </div>

      {/* ドロップダウン */}
      {open && options.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto
          bg-stone-800/95 border border-stone-600 rounded-lg shadow-2xl text-sm
          backdrop-blur-sm">
          {options.map(o => (
            <li
              key={o.id}
              onMouseDown={() => select(o)}
              className="px-3 py-2 cursor-pointer hover:bg-stone-700
                flex items-center justify-between gap-2 text-stone-100"
            >
              <span className="font-medium truncate">{o.shikona}</span>
              <span className="text-xs text-stone-500 shrink-0 whitespace-nowrap">
                {o.status === "retired" ? "引退" : "現役"}
                {o.heya ? ` · ${o.heya.name}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

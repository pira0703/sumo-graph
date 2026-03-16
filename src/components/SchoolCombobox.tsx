"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  label: string;           // "高校" | "大学"
  apiType: "high_school" | "university";
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

/**
 * マスター登録機能付きフィルタラブルドロップダウン
 * - 既存の学校名を絞り込み選択できる
 * - 一致しない文字列を入力して選択すると新規登録扱い
 */
export default function SchoolCombobox({
  label,
  apiType,
  value,
  onChange,
  placeholder,
}: Props) {
  const [options, setOptions] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // マスター取得
  useEffect(() => {
    setLoading(true);
    fetch(`/api/schools?type=${apiType}`)
      .then((r) => r.json())
      .then((data) => {
        const list: string[] =
          apiType === "high_school"
            ? (data.high_schools ?? [])
            : (data.universities ?? []);
        setOptions(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiType]);

  // 親の value が外部から変わったら同期
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // 外クリックで閉じる
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(inputValue.toLowerCase())
  );

  const isNew = inputValue.trim() !== "" && !options.includes(inputValue.trim());

  function select(v: string) {
    setInputValue(v);
    onChange(v);
    setOpen(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  }

  function handleClear() {
    setInputValue("");
    onChange("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs text-stone-400 mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <input
            type="text"
            className="w-full border border-stone-600 rounded px-2 py-1 text-sm bg-stone-800 text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-1 focus:ring-amber-400 pr-8"
            value={inputValue}
            placeholder={loading ? "読み込み中…" : (placeholder ?? `${label}名を入力または選択`)}
            onChange={handleInputChange}
            onFocus={() => setOpen(true)}
          />
          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ドロップダウンリスト */}
      {open && (filtered.length > 0 || isNew) && (
        <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-stone-800 border border-stone-600 rounded shadow-lg text-sm">
          {/* 新規登録候補 */}
          {isNew && (
            <li
              className="px-3 py-2 cursor-pointer text-amber-400 hover:bg-stone-700 border-b border-stone-700 flex items-center gap-2"
              onMouseDown={() => select(inputValue.trim())}
            >
              <span className="text-xs bg-amber-800 text-amber-200 px-1 rounded">新規</span>
              「{inputValue.trim()}」を登録
            </li>
          )}
          {/* 既存候補 */}
          {filtered.map((opt) => (
            <li
              key={opt}
              className={`px-3 py-2 cursor-pointer hover:bg-stone-700 ${
                opt === inputValue ? "bg-stone-700 text-amber-300" : "text-stone-100"
              }`}
              onMouseDown={() => select(opt)}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

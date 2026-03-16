import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ─── えにし デザイントークン ─────────────────────────────────
        washi:  "#F5F0EB",          // 和紙 — メイン背景
        ink:    "#1A1410",          // 墨黒 — テキスト
        enishi: {
          DEFAULT: "#5B3A8A",       // 江戸紫 — プライマリアクセント
          pale:    "#EDE6F5",       // 薄紫 — アクティブ背景
          light:   "#7B5CAA",       // 明るい紫
        },
        gold:   "#C8982A",          // 輝金 — 横綱・重要要素
        sand:   "#D8CFC6",          // 砂鼠 — ボーダー
        // ─── 後方互換（旧 dohyo トークン）─────────────────────────
        dohyo: {
          sand: "#c8a96e",
          dark: "#1a0a00",
          red:  "#8b0000",
          rope: "#4a3728",
        },
      },
      fontFamily: {
        serif: ["Noto Serif JP", "Yu Mincho", "serif"],
        sans:  ["Noto Sans JP", "Hiragino Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;

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
        dohyo: {
          sand: "#c8a96e",
          dark: "#1a0a00",
          red: "#8b0000",
          rope: "#4a3728",
        },
      },
    },
  },
  plugins: [],
};
export default config;

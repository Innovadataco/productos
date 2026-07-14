import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-plus-jakarta)", "system-ui", "sans-serif"],
        mono: ["var(--font-dm-mono)", "monospace"],
      },
      colors: {
        primary: {
          50: "#f0f5ff",
          100: "#dbe4ff",
          200: "#b8cdff",
          300: "#8aadff",
          400: "#5c88ff",
          500: "#3b6bff",
          600: "#2a50db",
          700: "#1f3eb0",
          800: "#1a327a",
          900: "#152855",
        },
        accent: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
        },
      },
      animation: {
        floatUp: "floatUp 0.6s ease-out forwards",
      },
      keyframes: {
        floatUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
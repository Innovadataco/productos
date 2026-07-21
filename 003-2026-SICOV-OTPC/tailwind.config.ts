import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Verde institucional (paridad con el look SICOV)
        sicov: {
          600: "#166534",
          700: "#15803d",
        },
      },
    },
  },
  plugins: [],
};

export default config;

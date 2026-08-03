import type { Config } from "tailwindcss";

/**
 * SPEC-157 — Sistema de diseño de Protección Infantil (BRIEF v3.0 §4).
 * Colores por variable de canal RGB (`rgb(var(--…-rgb) / <alpha-value>)`) para
 * admitir alpha sin color crudo; los valores viven en `globals.css` (:root/.dark).
 * `primary` se mapea a la familia cielo y `accent` a pino: los usos existentes de
 * `primary-*`/`accent-*` siguen resolviendo con valores por token.
 */
const config: Config = {
    darkMode: "class",
    content: [
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ["var(--font-instrument-sans)", "system-ui", "sans-serif"],
                serif: ["var(--font-instrument-serif)", "Georgia", "serif"],
                mono: ["var(--font-dm-mono)", "monospace"],
            },
            colors: {
                /* §4.2 Paleta con nombre */
                pino: "rgb(var(--pino-rgb) / <alpha-value>)",
                cielo: "rgb(var(--cielo-rgb) / <alpha-value>)",
                ambar: "rgb(var(--ambar-rgb) / <alpha-value>)",
                rubi: "rgb(var(--rubi-rgb) / <alpha-value>)",
                papel: "rgb(var(--papel-rgb) / <alpha-value>)",
                tinta: "rgb(var(--tinta-rgb) / <alpha-value>)",
                /* Mapeo legacy: primary = familia cielo, accent = familia pino */
                primary: {
                    50: "rgb(var(--cielo-rgb) / 0.06)",
                    100: "rgb(var(--cielo-100-rgb) / <alpha-value>)",
                    200: "rgb(var(--cielo-rgb) / 0.25)",
                    300: "rgb(var(--cielo-rgb) / 0.45)",
                    400: "rgb(var(--cielo-rgb) / 0.7)",
                    500: "rgb(var(--cielo-rgb) / <alpha-value>)",
                    600: "rgb(var(--cielo-600-rgb) / <alpha-value>)",
                    700: "rgb(var(--cielo-700-rgb) / <alpha-value>)",
                    800: "rgb(var(--cielo-700-rgb) / <alpha-value>)",
                    900: "rgb(var(--cielo-700-rgb) / <alpha-value>)",
                },
                accent: {
                    50: "rgb(var(--pino-rgb) / 0.06)",
                    100: "rgb(var(--pino-100-rgb) / <alpha-value>)",
                    200: "rgb(var(--pino-rgb) / 0.25)",
                    300: "rgb(var(--pino-rgb) / 0.45)",
                    400: "rgb(var(--pino-rgb) / 0.7)",
                    500: "rgb(var(--pino-rgb) / <alpha-value>)",
                    600: "rgb(var(--pino-600-rgb) / <alpha-value>)",
                    700: "rgb(var(--pino-700-rgb) / <alpha-value>)",
                },
            },
            /* §4.5 Una sola curva en todo el producto */
            transitionTimingFunction: {
                barrido: "var(--curva)",
            },
            animation: {
                floatUp: "floatUp 0.5s var(--curva) forwards",
                fadeIn: "fadeIn 0.4s var(--curva) forwards",
                pulseSlow: "pulseSlow 3.4s var(--curva) infinite",
            },
            keyframes: {
                floatUp: {
                    "0%": { opacity: "0", transform: "translateY(12px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                fadeIn: {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                pulseSlow: {
                    "0%, 100%": { opacity: "1" },
                    "50%": { opacity: "0.7" },
                },
            },
        },
    },
    plugins: [],
};
export default config;

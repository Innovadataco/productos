import type { Config } from "tailwindcss";

/**
 * Sistema de diseño calcado de PI (SPEC-157 · BRIEF v3.0 §4) — mismos tokens
 * por canal RGB (`rgb(var(--…-rgb) / <alpha-value>)`); los valores viven en
 * `globals.css` (:root/.dark). Referencia visual: mockup-bi-v2.html.
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
                pino: "rgb(var(--pino-rgb) / <alpha-value>)",
                cielo: "rgb(var(--cielo-rgb) / <alpha-value>)",
                ambar: "rgb(var(--ambar-rgb) / <alpha-value>)",
                rubi: "rgb(var(--rubi-rgb) / <alpha-value>)",
                papel: "rgb(var(--papel-rgb) / <alpha-value>)",
                tinta: "rgb(var(--tinta-rgb) / <alpha-value>)",
            },
            transitionTimingFunction: {
                barrido: "var(--curva)",
            },
        },
    },
    plugins: [],
};
export default config;

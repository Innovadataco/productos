/**
 * SPEC-662 · CANDADO DE RENDER — el foco de teclado es un OUTLINE visible y neutro.
 *
 * Defecto de accesibilidad vivo: el foco se dibujaba con un `ring` de Tailwind (box-shadow),
 * y un box-shadow se RECORTA dentro de `overflow:hidden` (una tarjeta) → quien navega con
 * teclado no ve dónde está parado. Peor en formularios (`.ring-accent-input`), donde el
 * halo era además al 30% y en TODOS los temas seguía siendo box-shadow. Fix (SPEC-662): un
 * OUTLINE de tinta neutra (`--tinta-rgb`), que el overflow no recorta, mismo color en los 4
 * temas (la tinta voltea por modo, no por tema).
 *
 * Vara PROPIA (no la de contraste de texto): el foco es un componente de UI → WCAG 1.4.11
 * pide ≥ 3:1. Este candado afirma, para `.ring-accent` (:focus-visible, botones/enlaces) y
 * `.ring-accent-input` (:focus, formularios), en los 4 temas × claro/oscuro:
 *   (1) EXISTE un outline al enfocar (outline-style ≠ none y ancho > 0) — no un box-shadow.
 *   (2) contraste outline↔fondo ≥ 3:1.
 *   (3) el color del outline es NEUTRO: el mismo en los 4 temas (no sigue al rol).
 * El foco se dispara con Tab (teclado) para que `:focus-visible` matchee de verdad.
 *
 * Ejercido las dos caras: con el fix, verde; volviendo a un `ring`/box-shadow (outline:none)
 * o a un color por rol, se pone rojo.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CSS = readFileSync(resolve(__dirname, "../../src/app/globals.css"), "utf-8");
const TEMAS = ["theme-padre", "theme-profesional", "theme-admin", "theme-colegio"];
const MINIMO = 3.0;

type RGB = [number, number, number];
function parse(s: string): RGB | null {
    const m = s && s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const n = m[1].split(/[,\s/]+/).filter(Boolean).slice(0, 3).map((x) => Math.round(parseFloat(x)));
    return n.length === 3 && n.every((v) => !Number.isNaN(v)) ? (n as RGB) : null;
}
function canal(c: number): number {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function lum([r, g, b]: RGB): number {
    return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}
function contraste(a: RGB, b: RGB): number {
    const la = lum(a), lb = lum(b), hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
}
const fmt = (c: RGB | null) => (c ? `rgb(${c.join(" ")})` : "?");

interface Medida {
    outlineColor: string;
    outlineStyle: string;
    outlineWidth: string;
    papel: string;
}

async function main(): Promise<void> {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const fallos: string[] = [];
    try {
        for (const dark of [false, true]) {
            const modo = dark ? "oscuro" : "claro";
            const colorBoton: string[] = [];
            const colorInput: string[] = [];
            for (const clase of TEMAS) {
                // El elemento de `.ring-accent` es un <span tabindex> a propósito, NO un
                // <button>: hay un fallback `button:focus-visible { outline: currentColor }`
                // que le daría outline al botón aunque `.ring-accent` esté rota → enmascara
                // la regla. Un span aísla la regla de `.ring-accent` (sin fallback nativo).
                const html = `<!doctype html><html class="${dark ? "dark" : ""}"><head><style>${CSS}</style></head><body><div class="${clase}"><span class="ring-accent" id="boton" tabindex="0">Elemento</span><input class="ring-accent-input" id="campo" /><span id="papel" style="background: rgb(var(--papel-rgb))"></span></div></body></html>`;
                await page.setContent(html);
                const medir = (id: string): Promise<Medida> =>
                    page.evaluate((elId) => {
                        const el = document.getElementById(elId)!;
                        const cs = getComputedStyle(el);
                        return {
                            outlineColor: cs.outlineColor,
                            outlineStyle: cs.outlineStyle,
                            outlineWidth: cs.outlineWidth,
                            papel: getComputedStyle(document.getElementById("papel")!).backgroundColor,
                        };
                    }, id);

                // Tab enfoca el botón con teclado → :focus-visible matchea de verdad.
                await page.keyboard.press("Tab");
                const b = await medir("boton");
                // Segundo Tab → el input (su regla es :focus, keyboard también lo dispara).
                await page.keyboard.press("Tab");
                const i = await medir("campo");

                for (const [rol, m] of [["botón (.ring-accent)", b], ["input (.ring-accent-input)", i]] as const) {
                    const col = parse(m.outlineColor), papel = parse(m.papel);
                    if (m.outlineStyle === "none" || parseFloat(m.outlineWidth) === 0 || !col) {
                        fallos.push(`${clase}/${modo}: el ${rol} NO tiene outline al enfocar (style=${m.outlineStyle} width=${m.outlineWidth}) — ¿volvió a un ring/box-shadow? El box-shadow lo recorta overflow:hidden (SPEC-662).`);
                        continue;
                    }
                    if (papel) {
                        const c = contraste(col, papel);
                        if (c < MINIMO) {
                            fallos.push(`${clase}/${modo}: el outline del ${rol} ${fmt(col)} da ${c.toFixed(2)} < 3:1 sobre papel (WCAG 1.4.11).`);
                        }
                    }
                    if (rol.startsWith("botón")) colorBoton.push(m.outlineColor);
                    else colorInput.push(m.outlineColor);
                }
            }
            const neutro = (colores: string[], rol: string) => {
                const distintos = [...new Set(colores)];
                if (distintos.length > 1) {
                    fallos.push(`${modo}: el outline del ${rol} NO es neutro — varía por tema (${distintos.join(" | ")}). SPEC-662: el foco es tinta neutra, el mismo color en los 4 temas.`);
                }
            };
            neutro(colorBoton, "botón");
            neutro(colorInput, "input");
        }
    } finally {
        await browser.close();
    }
    if (fallos.length) {
        console.error("[render:foco] SPEC-662 · el foco de teclado NO cumple:\n  " + fallos.join("\n  "));
        process.exit(1);
    }
    console.log("[render:foco] VERDE: el foco de `.ring-accent` y `.ring-accent-input` es un OUTLINE visible (≥ 3:1) y neutro (mismo color en los 4 temas × 2 modos). No lo recorta overflow:hidden.");
}

void main();

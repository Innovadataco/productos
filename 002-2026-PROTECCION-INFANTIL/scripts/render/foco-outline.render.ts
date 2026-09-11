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
 * SPEC-667 · TERCER consumidor del foco: el FALLBACK nativo
 * (`button/a/[role=button]:focus-visible`) usaba `outline: currentColor` → la visibilidad
 * dependía del COLOR del propio elemento (un enlace en `cielo` = 2.37:1). Ahora es la misma
 * tinta neutra. Cierra la clase que abrió SPEC-662, el último rincón.
 *
 * Vara PROPIA (no la de contraste de texto): el foco es un componente de UI → WCAG 1.4.11
 * pide ≥ 3:1. Este candado afirma, para los TRES consumidores —`.ring-accent`
 * (:focus-visible, botones/enlaces), `.ring-accent-input` (:focus, formularios) y el FALLBACK
 * nativo (<a>/<button> sin .ring-accent)— en los 4 temas × claro/oscuro:
 *   (1) EXISTE un outline al enfocar (outline-style ≠ none y ancho > 0) — no un box-shadow.
 *   (2) contraste outline↔fondo ≥ 3:1.
 *   (3) el color del outline es NEUTRO: el mismo en los 4 temas (no sigue al rol ni al color
 *       del elemento).
 * El foco se dispara con Tab (teclado), nunca `.focus()`, para que `:focus-visible` matchee.
 *
 * EL SUJETO AÍSLA LA REGLA (lección afinada, SPEC-667): el sujeto de prueba no es «el más
 * desnudo» por principio, sino el que aísla la regla bajo prueba. Para `.ring-accent` el
 * sujeto es un <span tabindex> SIN fallback nativo (si fuera <button>, el fallback lo pintaría
 * y daría falso verde). Para el FALLBACK es al revés: un <a>/<button> nativo, que ES quien
 * trae la regla. Mismo candado, sujetos opuestos, según qué se mide.
 *
 * Ejercido las dos caras: con el fix, verde; volviendo a `ring`/box-shadow, a color por rol,
 * o a `currentColor` en el fallback, se pone rojo.
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
            const colorFallback: string[] = [];
            for (const clase of TEMAS) {
                // El SUJETO aísla la REGLA bajo prueba (la lección afinada por SPEC-667):
                //  · `.ring-accent` → <span tabindex>, NO <button>: si fuera botón, el fallback
                //    nativo le daría outline aunque `.ring-accent` esté rota (falso verde). El
                //    span no trae fallback propio: lo único que pinta el contorno es la regla probada.
                //  · el FALLBACK nativo → al revés: un <a> nativo SIN `.ring-accent`, con color de
                //    acento (`text-accent`), que es justo el caso que fallaba (enlace `cielo` = 2.37
                //    con `currentColor`). Acá el fallback ES la regla, así que el sujeto debe traerlo.
                const html = `<!doctype html><html class="${dark ? "dark" : ""}"><head><style>${CSS}</style></head><body><div class="${clase}"><span class="ring-accent" id="boton" tabindex="0">Elemento</span><input class="ring-accent-input" id="campo" /><a class="text-accent" id="fallback" href="#">Enlace</a><span id="papel" style="background: rgb(var(--papel-rgb))"></span></div></body></html>`;
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
                // Tercer Tab → el <a> nativo (fallback). Su color es el acento, así que
                // `currentColor` daría un outline de acento (cielo = 2.37); la regla correcta
                // lo pinta de tinta neutra sin importar el color del elemento.
                await page.keyboard.press("Tab");
                const f = await medir("fallback");

                for (const [rol, m, coleccion] of [
                    ["botón (.ring-accent)", b, colorBoton],
                    ["input (.ring-accent-input)", i, colorInput],
                    ["enlace nativo sin .ring-accent (fallback)", f, colorFallback],
                ] as const) {
                    const col = parse(m.outlineColor), papel = parse(m.papel);
                    if (m.outlineStyle === "none" || parseFloat(m.outlineWidth) === 0 || !col) {
                        fallos.push(`${clase}/${modo}: el ${rol} NO tiene outline al enfocar (style=${m.outlineStyle} width=${m.outlineWidth}).`);
                        continue;
                    }
                    if (papel) {
                        const c = contraste(col, papel);
                        if (c < MINIMO) {
                            fallos.push(`${clase}/${modo}: el outline del ${rol} ${fmt(col)} da ${c.toFixed(2)} < 3:1 sobre papel (WCAG 1.4.11).`);
                        }
                    }
                    coleccion.push(m.outlineColor);
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
            neutro(colorFallback, "enlace/fallback nativo");
        }
    } finally {
        await browser.close();
    }
    if (fallos.length) {
        console.error("[render:foco] SPEC-662 · el foco de teclado NO cumple:\n  " + fallos.join("\n  "));
        process.exit(1);
    }
    console.log("[render:foco] VERDE: el foco de `.ring-accent`, `.ring-accent-input` y el FALLBACK nativo (button/a/[role=button] sin .ring-accent) es un OUTLINE visible (≥ 3:1) y neutro (mismo color en los 4 temas × 2 modos). No depende del color del elemento ni lo recorta overflow:hidden.");
}

void main();

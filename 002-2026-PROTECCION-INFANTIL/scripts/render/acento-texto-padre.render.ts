/**
 * SPEC-873 (I-406) · CANDADO DE RENDER — el acento del PADRE como TEXTO, medido en un navegador.
 *
 * El defecto: `.theme-padre` fija `--accent-rgb: var(--cielo-rgb)` (cielo crudo) y `.text-accent`
 * resuelve `color: rgb(var(--accent-rgb))` → el texto de acento del padre (un enlace) salía en cielo
 * crudo = 2.37:1 sobre papel en claro. Ilegible. Fix (SPEC-873): `.theme-padre .text-accent` resuelve
 * a `--cielo-700-rgb` (la variante «ink» mode-aware: #2c5f99 claro / #9cc9f5 oscuro), SOLO el camino de
 * TEXTO — `--accent-rgb` NO cambia (es relleno de botones, donde cielo crudo es correcto).
 *
 * Por qué RENDER y no regex: jsdom/regex NO computan la cascada de custom properties por clase (la
 * lección de I-392 e I-404). Acá se carga globals.css en Chromium real y se mide el COLOR EFECTIVO con
 * getComputedStyle. En LOS DOS TEMAS (claro y oscuro): un candado de un solo tema es lo que dejó pasar
 * a I-404.
 *
 * Afirma, para `.theme-padre` × claro/oscuro:
 *   (1) el TEXTO de `.text-accent` resuelve a `--cielo-700-rgb` (el fix), NO a `--cielo-rgb` (el bug).
 *   (2) contraste texto↔papel ≥ 4.5 (AA).
 *   (3) control positivo: el valor del BUG (`--cielo-rgb` como texto) da < 4.5 en claro — prueba que el
 *       candado no es vacuo (si no, «≥4.5» pasaría sin que el fix importe).
 *
 * Ejercido (las dos caras): con el fix, verde; revirtiendo el fix (`.text-accent` del padre vuelve a
 * `--accent-rgb`=cielo crudo) cae a 2.37 en claro → (1) y (2) ROJO.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CSS = readFileSync(resolve(__dirname, "../../src/app/globals.css"), "utf-8");

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
const eq = (a: RGB | null, b: RGB | null) => !!a && !!b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

async function main(): Promise<void> {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const fallos: string[] = [];
    try {
        for (const dark of [false, true]) {
            const modo = dark ? "oscuro" : "claro";
            // `texto` = un `.text-accent` real dentro de `.theme-padre` (mide el color EFECTIVO del enlace).
            // Sondas: `cielo700` = el objetivo legible; `cielocrudo` = el valor del bug; `papel` = el fondo real.
            const html = `<!doctype html><html class="${dark ? "dark" : ""}"><head><style>${CSS}</style></head><body><div class="theme-padre"><span id="texto" class="text-accent">Enlace</span><span id="cielo700" style="color: rgb(var(--cielo-700-rgb))"></span><span id="cielocrudo" style="color: rgb(var(--cielo-rgb))"></span><span id="papel" style="background: rgb(var(--papel-rgb))"></span></div></body></html>`;
            await page.setContent(html);
            const r = await page.evaluate(() => ({
                texto: getComputedStyle(document.getElementById("texto")!).color,
                cielo700: getComputedStyle(document.getElementById("cielo700")!).color,
                cielocrudo: getComputedStyle(document.getElementById("cielocrudo")!).color,
                papel: getComputedStyle(document.getElementById("papel")!).backgroundColor,
            }));
            const texto = parse(r.texto), cielo700 = parse(r.cielo700), cielocrudo = parse(r.cielocrudo), papel = parse(r.papel);
            if (!texto || !cielo700 || !cielocrudo || !papel) {
                fallos.push(`${modo}: no pude medir (texto=${r.texto} cielo700=${r.cielo700} papel=${r.papel}). ¿Cambiaron .text-accent / --cielo-700-rgb / --papel-rgb?`);
                continue;
            }
            // (1) el TEXTO del acento del padre resuelve a cielo-700 (el fix), NO a cielo crudo (el bug).
            if (!eq(texto, cielo700)) {
                fallos.push(`${modo}: el TEXTO de .text-accent del padre ${fmt(texto)} NO es --cielo-700-rgb ${fmt(cielo700)} — el fix de I-406 no está aplicado (¿.theme-padre .text-accent?).`);
            }
            if (eq(texto, cielocrudo)) {
                fallos.push(`${modo}: el TEXTO de .text-accent del padre quedó en cielo CRUDO ${fmt(cielocrudo)} — regresión I-406 (el enlace vuelve a 2.37:1 en claro).`);
            }
            // (2) contraste texto↔papel ≥ 4.5 (AA).
            const c = contraste(texto, papel);
            if (c < 4.5) {
                fallos.push(`${modo}: contraste del TEXTO de acento del padre ${c.toFixed(2)} < 4.5 sobre papel (texto ${fmt(texto)}, papel ${fmt(papel)}).`);
            }
            // (3) control positivo (claro): el valor del BUG es ilegible — el candado no es vacuo.
            if (!dark) {
                const cBug = contraste(cielocrudo, papel);
                if (cBug >= 4.5) {
                    fallos.push(`claro: el control positivo falló — cielo CRUDO como texto da ${cBug.toFixed(2)} ≥ 4.5; el candado no distinguiría el bug del fix (¿cambió --cielo-rgb o --papel-rgb?).`);
                }
            }
        }
    } finally {
        await browser.close();
    }
    if (fallos.length) {
        console.error("[render:check] SPEC-873 (I-406) · el acento del padre como TEXTO FALLA:\n  " + fallos.join("\n  "));
        process.exit(1);
    }
    console.log("[render:check] VERDE: el TEXTO de acento del padre (.theme-padre .text-accent) resuelve a --cielo-700-rgb y contrasta ≥ 4.5 sobre papel en los 2 temas (y el valor del bug, cielo crudo, da < 4.5 en claro — control positivo).");
}

void main();

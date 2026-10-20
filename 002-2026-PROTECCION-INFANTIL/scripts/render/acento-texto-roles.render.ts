/**
 * SPEC-876 (barrido de contraste · reconcilia y SUBSUME el candado de SPEC-873/I-406) · CANDADO DE RENDER
 * ESTRUCTURAL — el acento COMO TEXTO (.text-accent) de CADA tema de rol, medido en un navegador.
 *
 * El defecto (I-406 · #872): `.theme-padre`/`.theme-profesional` fijan `--accent-rgb: var(--cielo-rgb)`
 * (cielo crudo) y .text-accent resuelve `color: rgb(var(--accent-rgb))` → el texto de acento (un enlace)
 * salía en cielo crudo = 2.37:1 sobre papel en claro. Ilegible. Fix: `.theme-padre .text-accent` y
 * `.theme-profesional .text-accent` resuelven a `--cielo-700-rgb` (variante «ink» mode-aware), SOLO el
 * camino de TEXTO (`--accent-rgb` NO cambia: es relleno de botones, donde cielo crudo es correcto).
 *
 * Por qué RENDER y no regex: jsdom/regex NO computan la cascada de custom properties por clase (lección de
 * I-392 e I-404). Acá se carga globals.css en Chromium real y se mide el COLOR EFECTIVO con getComputedStyle,
 * en LOS DOS TEMAS (claro y oscuro) — un cálculo de un solo tema dejó pasar a I-404.
 *
 * ESTRUCTURAL (SPEC-876, reemplaza a `acento-texto-padre.render.ts`): AUTO-DESCUBRE los temas de rol desde
 * `globals.css` (todo `.theme-X { … --accent-rgb … }`) y exige, para CADA uno × claro/oscuro:
 *   (1) contraste de .text-accent sobre papel ≥ 4.5 (AA) — caza padre + profesional + colegio + admin +
 *       cualquier tema FUTURO que herede cielo crudo a texto.
 * Preserva las invariantes de 873:
 *   (2) PADRE y PROFESIONAL resuelven el texto a `--cielo-700-rgb` (el fix), NO a `--cielo-rgb` (el bug).
 *   (3) control positivo: cielo CRUDO como texto da < 4.5 en claro — el candado no es vacuo.
 *
 * Ejercido (las dos caras): con el fix, verde; revirtiendo cualquier `.theme-* .text-accent` a cielo crudo
 * cae a 2.37 en claro → (1)/(2) ROJO en ambos temas.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CSS = readFileSync(resolve(__dirname, "../../src/app/globals.css"), "utf-8");

// Auto-descubre los temas de rol: cada bloque `.theme-X { … --accent-rgb … }` declara el acento del rol.
const TEMAS = [...CSS.matchAll(/\.theme-([a-z]+)\s*\{[^}]*--accent-rgb/g)].map((m) => `theme-${m[1]}`);
// Temas que deben resolver el TEXTO a cielo-700 (el fix de I-406/#872). El resto (colegio/admin) tiene su
// propio acento legible y NO se toca; igual se mide su contraste (1).
const TEMAS_CIELO_INK = new Set(["theme-padre", "theme-profesional"]);

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
    const fallos: string[] = [];
    // Control de no-vacío: si el auto-descubrimiento devuelve 0 temas, el candado no probaría NADA (falso
    // verde). Exigimos ≥4 (padre/profesional/colegio/admin existen hoy).
    if (TEMAS.length < 4) {
        console.error(`[render:check] SPEC-876 · auto-descubrí ${TEMAS.length} temas (<4): ¿cambió el patrón \`.theme-X { --accent-rgb … }\` en globals.css?`);
        process.exit(1);
    }

    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        for (const dark of [false, true]) {
            const modo = dark ? "oscuro" : "claro";
            for (const clase of TEMAS) {
                const html = `<!doctype html><html class="${dark ? "dark" : ""}"><head><style>${CSS}</style></head><body><div class="${clase}"><span id="texto" class="text-accent">Enlace</span><span id="cielo700" style="color: rgb(var(--cielo-700-rgb))"></span><span id="cielocrudo" style="color: rgb(var(--cielo-rgb))"></span><span id="papel" style="background: rgb(var(--papel-rgb))"></span></div></body></html>`;
                await page.setContent(html);
                const r = await page.evaluate(() => ({
                    texto: getComputedStyle(document.getElementById("texto")!).color,
                    cielo700: getComputedStyle(document.getElementById("cielo700")!).color,
                    cielocrudo: getComputedStyle(document.getElementById("cielocrudo")!).color,
                    papel: getComputedStyle(document.getElementById("papel")!).backgroundColor,
                }));
                const texto = parse(r.texto), cielo700 = parse(r.cielo700), cielocrudo = parse(r.cielocrudo), papel = parse(r.papel);
                if (!texto || !cielo700 || !cielocrudo || !papel) {
                    fallos.push(`${clase}/${modo}: no pude medir (texto=${r.texto} papel=${r.papel}).`);
                    continue;
                }
                // (1) contraste del TEXTO de acento ≥ 4.5 sobre papel.
                const c = contraste(texto, papel);
                if (c < 4.5) {
                    fallos.push(`${clase}/${modo}: .text-accent ${fmt(texto)} da ${c.toFixed(2)} < 4.5 sobre papel ${fmt(papel)} — acento ilegible como texto.`);
                }
                // (2) padre/profesional: el TEXTO resuelve a cielo-700 (fix), NO a cielo crudo (bug).
                if (TEMAS_CIELO_INK.has(clase)) {
                    if (!eq(texto, cielo700)) {
                        fallos.push(`${clase}/${modo}: .text-accent ${fmt(texto)} NO es --cielo-700-rgb ${fmt(cielo700)} — falta el fix de I-406/#872 (¿.theme-* .text-accent?).`);
                    }
                    if (eq(texto, cielocrudo)) {
                        fallos.push(`${clase}/${modo}: .text-accent quedó en cielo CRUDO ${fmt(cielocrudo)} — regresión (vuelve a 2.37:1 en claro).`);
                    }
                }
            }
            // SPEC-880: los tokens de ESTADO como texto (el fix del barrido codebase-wide) contrastan ≥ 4.5
            // sobre papel en los DOS temas (estado-cielo 5.76/11.40 · estado-ambar 5.11/10.72 · estado-pino
            // 8.98/…). Son utilidades mode-aware, independientes del tema de rol: se miden una vez por modo.
            {
                const htmlE = `<!doctype html><html class="${dark ? "dark" : ""}"><head><style>${CSS}</style></head><body><span id="ec" class="text-estado-cielo"></span><span id="ea" class="text-estado-ambar"></span><span id="ep" class="text-estado-pino"></span><span id="pp" style="background: rgb(var(--papel-rgb))"></span></body></html>`;
                await page.setContent(htmlE);
                const re = await page.evaluate(() => ({
                    ec: getComputedStyle(document.getElementById("ec")!).color,
                    ea: getComputedStyle(document.getElementById("ea")!).color,
                    ep: getComputedStyle(document.getElementById("ep")!).color,
                    pp: getComputedStyle(document.getElementById("pp")!).backgroundColor,
                }));
                const pp = parse(re.pp);
                for (const [nombre, val] of [["estado-cielo", re.ec], ["estado-ambar", re.ea], ["estado-pino", re.ep]] as const) {
                    const col = parse(val);
                    if (!col || !pp) {
                        fallos.push(`${nombre}/${modo}: no pude medir (color=${val} papel=${re.pp}).`);
                        continue;
                    }
                    const c = contraste(col, pp);
                    if (c < 4.5) {
                        fallos.push(`${nombre}/${modo}: ${fmt(col)} da ${c.toFixed(2)} < 4.5 sobre papel ${fmt(pp)} — el fix del barrido SPEC-880 no es legible.`);
                    }
                }
            }
            // (3) control positivo (claro): el valor del BUG (cielo crudo) es ilegible — el candado no es vacuo.
            if (!dark) {
                const html = `<!doctype html><html><head><style>${CSS}</style></head><body><div class="theme-padre"><span id="cielocrudo" style="color: rgb(var(--cielo-rgb))"></span><span id="papel" style="background: rgb(var(--papel-rgb))"></span></div></body></html>`;
                await page.setContent(html);
                const r = await page.evaluate(() => ({
                    cielocrudo: getComputedStyle(document.getElementById("cielocrudo")!).color,
                    papel: getComputedStyle(document.getElementById("papel")!).backgroundColor,
                }));
                const cielocrudo = parse(r.cielocrudo), papel = parse(r.papel);
                if (cielocrudo && papel) {
                    const cBug = contraste(cielocrudo, papel);
                    if (cBug >= 4.5) {
                        fallos.push(`claro: control positivo falló — cielo CRUDO como texto da ${cBug.toFixed(2)} ≥ 4.5; el candado no distinguiría bug de fix (¿cambió --cielo-rgb/--papel-rgb?).`);
                    }
                }
            }
        }
    } finally {
        await browser.close();
    }
    if (fallos.length) {
        console.error("[render:check] SPEC-876 · acento como TEXTO por rol FALLA:\n  " + fallos.join("\n  "));
        process.exit(1);
    }
    console.log(`[render:check] VERDE: .text-accent de los ${TEMAS.length} temas (${TEMAS.join(", ")}) contrasta ≥ 4.5 sobre papel en los 2 temas; padre+profesional resuelven a --cielo-700-rgb (cielo crudo < 4.5 en claro — control positivo); y los tokens de estado del barrido SPEC-880 (estado-cielo/ambar/pino como texto) ≥ 4.5 sobre papel en los 2 temas.`);
}

void main();

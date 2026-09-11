/**
 * I-392 · CANDADO DE RENDER — el acento por rol y el Fantasma neutro, medidos en un navegador.
 *
 * El defecto: `--pi-accent` se declaraba UNA vez en :root (var(--accent) → pino). Una
 * custom property con var() se sustituye donde se DECLARA; re-declarar `--accent-rgb` por
 * tema no reabría `--pi-accent`, así que el FONDO del Primario salía pino en todos los
 * temas mientras el rótulo (derivado por tema, SPEC-632) quedaba ilegible: 2.98:1 en claro
 * en el área del padre. Fix (I-392): `--pi-accent` se re-declara sobre `.btn-ds--primary`.
 *
 * Por qué RENDER y no regex: jsdom/regex NO computan la cascada de custom properties por
 * clase — el candado de texto (accent-por-rol.candado.test.ts) estuvo VERDE meses mientras
 * el defecto vivía. Acá se carga globals.css en Chromium real y se mide el COLOR EFECTIVO
 * con getComputedStyle: el compositing que pinta el navegador ES la respuesta a "¿se ve?".
 *
 * Afirma, para los 4 temas × claro/oscuro:
 *   (1) el fondo del `.btn-ds--primary` resuelve al color del ROL del tema
 *       (== rgb(var(--accent-rgb))), y en los temas cuyo rol NO es pino, NO al pino congelado.
 *   (2) contraste rótulo↔fondo del Primario ≥ 4.5.
 *   (3) el TEXTO del Fantasma (secondary/outline) contrasta ≥ 4.5 sobre papel.
 *   (4) el TEXTO del Fantasma es NEUTRO: el MISMO color en los 4 temas (no sigue al rol).
 *
 * EL FANTASMA ES NEUTRO POR DISEÑO (SPEC-659) — decisión CERRADA, no deuda. El `pino`
 * actual es interino: pasa a TINTA NEUTRA, NO al acento del tema (un acento COMO TEXTO
 * falla para acentos claros: `cielo` = 2.37:1 sobre papel; una tinta neutra contrasta
 * siempre). El color del territorio es la identidad del PRIMARIO — la firma no se reparte.
 * Las aserciones (3)+(4) AFIRMAN la decisión en vez de solo describirla: "completar" el
 * arreglo (re-declarar --pi-accent en un ancestro común y darle al Fantasma el acento del
 * rol) hace que su texto varíe por tema y caiga a 2.37 → este gate se pone ROJO.
 *
 * Ejercido (las dos caras): con el fix, verde; revirtiendo el fix del Primario (--pi-accent
 * congelado) da pino/2.98 → rojo; darle al Fantasma el acento del rol lo vuelve no-neutro y
 * cae a 2.37 → rojo.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CSS = readFileSync(resolve(__dirname, "../../src/app/globals.css"), "utf-8");

const TEMAS = [
    { clase: "theme-padre", rolEsPino: false },
    { clase: "theme-profesional", rolEsPino: false },
    { clase: "theme-admin", rolEsPino: false },
    { clase: "theme-colegio", rolEsPino: true },
];

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
            const fantasmaPorTema: Array<{ clase: string; color: RGB }> = [];
            for (const { clase, rolEsPino } of TEMAS) {
                // Un solo template literal (interpolado). Primario (mide su fondo) + Fantasma
                // (mide su texto) + sondas: `rol` = rgb(var(--accent-rgb)) (color del rol),
                // `pino` = rgb(var(--pino-rgb)) (el color congelado del bug), `papel` = fondo.
                const html = `<!doctype html><html class="${dark ? "dark" : ""}"><head><style>${CSS}</style></head><body><div class="${clase}"><button class="btn-ds btn-ds--primary" id="prim">Etiqueta</button><button class="btn-ds btn-ds--fantasma" id="fan">Etiqueta</button><span id="rol" style="color: rgb(var(--accent-rgb))"></span><span id="pino" style="color: rgb(var(--pino-rgb))"></span><span id="papel" style="background: rgb(var(--papel-rgb))"></span></div></body></html>`;
                await page.setContent(html);
                const r = await page.evaluate(() => {
                    const prim = document.getElementById("prim")!;
                    const grad = getComputedStyle(prim).backgroundImage;
                    const acc = (grad.match(/rgba?\([^)]+\)/) || [""])[0]; // 1er color del gradiente = --pi-accent
                    return {
                        accent: acc,
                        ink: getComputedStyle(prim).color,
                        rol: getComputedStyle(document.getElementById("rol")!).color,
                        pino: getComputedStyle(document.getElementById("pino")!).color,
                        fan: getComputedStyle(document.getElementById("fan")!).color,
                        papel: getComputedStyle(document.getElementById("papel")!).backgroundColor,
                    };
                });
                const acc = parse(r.accent), ink = parse(r.ink), rol = parse(r.rol), pino = parse(r.pino);
                const fan = parse(r.fan), papel = parse(r.papel);
                if (!acc || !ink || !rol || !pino || !fan || !papel) {
                    fallos.push(`${clase}/${modo}: no pude medir (acc=${r.accent} ink=${r.ink} fan=${r.fan}). ¿Cambiaron los nombres .btn-ds--primary/--fantasma o el gradiente?`);
                    continue;
                }
                // (1) el fondo del Primario resuelve al color del rol.
                if (!eq(acc, rol)) {
                    fallos.push(`${clase}/${modo}: el fondo del Primario ${fmt(acc)} NO es el color del rol ${fmt(rol)} — el acento no resuelve por tema.`);
                }
                if (!rolEsPino && eq(acc, pino)) {
                    fallos.push(`${clase}/${modo}: el fondo del Primario quedó en PINO ${fmt(pino)} — el acento se congeló (regresión I-392).`);
                }
                // (2) contraste rótulo↔fondo del Primario.
                const cPrim = contraste(ink, acc);
                if (cPrim < 4.5) {
                    fallos.push(`${clase}/${modo}: contraste rótulo↔fondo del Primario ${cPrim.toFixed(2)} < 4.5 (fondo ${fmt(acc)}, rótulo ${fmt(ink)}).`);
                }
                // (3) el TEXTO del Fantasma contrasta ≥ 4.5 sobre papel.
                const cFan = contraste(fan, papel);
                if (cFan < 4.5) {
                    fallos.push(`${clase}/${modo}: el TEXTO del Fantasma ${fmt(fan)} da ${cFan.toFixed(2)} < 4.5 sobre papel — dejó de ser neutro/legible (SPEC-659: el Fantasma NO lleva el acento del rol).`);
                }
                fantasmaPorTema.push({ clase, color: fan });
            }
            // (4) el TEXTO del Fantasma es NEUTRO: el mismo color en los 4 temas (no sigue al rol).
            const distintos = [...new Set(fantasmaPorTema.map((f) => f.color.join(",")))];
            if (distintos.length > 1) {
                fallos.push(
                    `${modo}: el TEXTO del Fantasma NO es neutro — varía por tema (` +
                        fantasmaPorTema.map((f) => `${f.clase}=${fmt(f.color)}`).join(", ") +
                        "). El Fantasma es neutro por diseño (SPEC-659): su texto NO debe seguir al acento del rol.",
                );
            }
        }
    } finally {
        await browser.close();
    }
    if (fallos.length) {
        console.error("[render:check] I-392 · el acento por rol / el Fantasma neutro FALLAN:\n  " + fallos.join("\n  "));
        process.exit(1);
    }
    console.log("[render:check] VERDE: el fondo del <Button> Primario resuelve al color del rol (4 temas × 2 modos, contraste ≥ 4.5) y el TEXTO del Fantasma es neutro (mismo color en los 4 temas, ≥ 4.5 sobre papel). SPEC-659: el Fantasma NO lleva el acento del rol.");
}

void main();

/**
 * I-404 · CANDADO DE RENDER — el rótulo del botón «Deshacer» del toast, medido
 * en un navegador, en los DOS temas (claro Y oscuro) y en las DOS caras que lo
 * montan (padre Y admin).
 *
 * El defecto (medido POR RENDER por Calidad): `AvisoDeshacerConfirmacion` pinta
 * el botón `bg-cielo text-white` → 2.70:1 claro / 2.17:1 oscuro, los dos bajo el
 * piso. Fase D mudó ese toast a la cara del padre; es el control que salva a
 * quien borró por error — un «Deshacer» que no se lee no es una red.
 *
 * Por qué RENDER y no cálculo (la lección del FORMA): la nota original calculó
 * SOLO el claro (2.70) y el oscuro era peor (2.17). Un cálculo de un solo tema
 * queda corto justo del lado que no se mira; el navegador compone el color real
 * en ambos modos. Y por qué en AMBAS caras: el toast es COMPARTIDO (padre+admin)
 * y el botón es `bg-cielo` en todos los temas, así que una tinta que dependa del
 * tema (p. ej. `--pi-accent-ink-rgb`, blanca por defecto fuera de cielo) dejaría
 * el bug vivo en admin. La tinta correcta es FIJA y global (`--pi-ink-oscuro-rgb`).
 *
 * El color del rótulo se LEE de la fuente, no se hardcodea: revertir a
 * `text-white` —o cambiar al token equivocado `--pi-accent-ink-rgb`— se mide tal
 * como lo pinta el navegador y cae por debajo de 4.5 → rojo. Ejercido por
 * mutación: `text-[rgb(var(--pi-ink-oscuro-rgb))]` da 6.84/8.51 (verde);
 * `text-white` da 2.70/2.17 (rojo); `--pi-accent-ink-rgb` cae en `theme-admin`.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve(__dirname, "../../src");
const CSS = readFileSync(resolve(SRC, "app/globals.css"), "utf-8");
const TOAST = readFileSync(
    resolve(SRC, "components/modules/reporte-detalle/AvisoDeshacerConfirmacion.tsx"),
    "utf-8",
);

// El toast lo montan padre y admin; el botón es bg-cielo en ambos. Medir en los
// dos temas destapa una tinta que dependa del tema (bug sobreviviente en admin).
const TEMAS = ["theme-padre", "theme-admin"];
const AA = 4.5;

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

/**
 * Color del rótulo y relleno del botón «Deshacer», LEÍDOS de la fuente: anclamos
 * en `onClick={onDeshacer}` y tomamos su `className`. `bg-cielo` es el sujeto
 * (relleno cielo); el color del rótulo puede ser `text-white` o `text-[<valor>]`.
 */
function botonDeshacer(src: string): { color: string; bgCielo: boolean } {
    const i = src.indexOf("onClick={onDeshacer}");
    if (i === -1) throw new Error("I-404: no encontré el botón onDeshacer — ¿cambió el componente?");
    const m = src.slice(i).match(/className="([^"]+)"/);
    if (!m) throw new Error("I-404: no encontré el className del botón onDeshacer.");
    const cls = m[1];
    const bgCielo = /\bbg-cielo\b/.test(cls);
    const arbitrario = cls.match(/text-\[([^\]]+)\]/);
    if (arbitrario) return { color: arbitrario[1], bgCielo };
    if (/\btext-white\b/.test(cls)) return { color: "rgb(255 255 255)", bgCielo };
    throw new Error(`I-404: no reconocí el color del rótulo en «${cls}».`);
}

async function main(): Promise<void> {
    const { color, bgCielo } = botonDeshacer(TOAST);
    const fallos: string[] = [];
    if (!bgCielo) {
        fallos.push("el botón «Deshacer» ya no es `bg-cielo` — cambió el sujeto del candado; revisar la FORMA I-404.");
    }
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        for (const dark of [false, true]) {
            const modo = dark ? "oscuro" : "claro";
            for (const tema of TEMAS) {
                // `bg-cielo` sin alpha = rgb(var(--cielo-rgb)); el rótulo, el valor
                // leído de la fuente. El tema importa porque un token por-tema
                // (accent-ink) resuelve distinto en admin.
                const html = `<!doctype html><html class="${dark ? "dark" : ""}"><head><style>${CSS}</style></head><body><div class="${tema}"><span id="rotulo" style="background: rgb(var(--cielo-rgb)); color: ${color}">Deshacer</span></div></body></html>`;
                await page.setContent(html);
                const r = await page.evaluate(() => {
                    const el = document.getElementById("rotulo")!;
                    const s = getComputedStyle(el);
                    return { color: s.color, bg: s.backgroundColor };
                });
                const fg = parse(r.color), bg = parse(r.bg);
                if (!fg || !bg) {
                    fallos.push(`${tema}/${modo}: no pude medir (color=${r.color} bg=${r.bg}).`);
                    continue;
                }
                const c = contraste(fg, bg);
                if (c < AA) {
                    fallos.push(
                        `${tema}/${modo}: el rótulo «Deshacer» da ${c.toFixed(2)} < ${AA} sobre el relleno cielo (fondo ${fmt(bg)}, rótulo ${fmt(fg)}). La tinta del botón cielo debe ser OSCURA y FIJA (--pi-ink-oscuro-rgb), no blanca ni dependiente del tema.`,
                    );
                }
            }
        }
    } finally {
        await browser.close();
    }
    if (fallos.length) {
        console.error("[render:deshacer] I-404 · el rótulo «Deshacer» no alcanza el contraste:\n  " + fallos.join("\n  "));
        process.exit(1);
    }
    console.log(
        "[render:deshacer] VERDE: el rótulo «Deshacer» sobre el relleno cielo contrasta ≥ 4.5 en padre+admin × claro/oscuro (color leído de la fuente).",
    );
}

void main();

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * SPEC-157 · T012 / SC-003 — Contraste de los pares derivados de tokens ≥ 4.5:1
 * en AMBOS temas. Lee los valores reales de `globals.css` (fuente única) y calcula
 * la razón de contraste WCAG: si un token se degrada, este test lo detecta.
 */

const GLOBALS = path.resolve(__dirname, "..", "app", "globals.css");

type Tokens = Record<string, [number, number, number]>;

function extraerBloque(css: string, selector: string): string {
    // El selector debe abrir un bloque real (seguido de `{`), no una mención en comentario.
    const patron = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{");
    const coincidencia = patron.exec(css);
    if (!coincidencia) throw new Error(`No se encontró el bloque ${selector} en globals.css`);
    const llave = css.indexOf("{", coincidencia.index);
    let profundidad = 0;
    for (let i = llave; i < css.length; i++) {
        if (css[i] === "{") profundidad++;
        if (css[i] === "}") {
            profundidad--;
            if (profundidad === 0) return css.slice(llave + 1, i);
        }
    }
    throw new Error(`Bloque ${selector} sin cerrar en globals.css`);
}

function parsearTokens(bloque: string): Tokens {
    const tokens: Tokens = {};
    const patron = /--([\w-]+)-rgb:\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g;
    let m: RegExpExecArray | null;
    while ((m = patron.exec(bloque)) !== null) {
        tokens[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
    }
    return tokens;
}

function canalLineal(c: number): number {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminancia([r, g, b]: [number, number, number]): number {
    return 0.2126 * canalLineal(r) + 0.7152 * canalLineal(g) + 0.0722 * canalLineal(b);
}

function contraste(a: [number, number, number], b: [number, number, number]): number {
    const la = luminancia(a);
    const lb = luminancia(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const css = fs.readFileSync(GLOBALS, "utf8");
const temas: Array<[string, Tokens]> = [
    ["claro", parsearTokens(extraerBloque(css, ":root"))],
    ["oscuro", parsearTokens(extraerBloque(css, ".dark"))],
];

// Pares SC-003: texto (body/muted/subtle) sobre papel + pino/ambar/rubí como texto de estado
const PARES: Array<[string, string]> = [
    ["tinta", "papel"],
    ["tinta-muted", "papel"],
    ["tinta-subtle", "papel"],
    ["pino-ink", "papel"],
    ["ambar-ink", "papel"],
    ["rubi-ink", "papel"],
];

describe("tokens del sistema de diseño (SPEC-157)", () => {
    it("define la paleta §4.2 en ambos temas", () => {
        for (const [tema, tokens] of temas) {
            for (const nombre of ["pino", "cielo", "ambar", "rubi", "papel", "tinta"]) {
                expect(tokens[nombre], `falta --${nombre}-rgb en tema ${tema}`).toBeTruthy();
            }
        }
    });

    for (const [tema, tokens] of temas) {
        describe(`tema ${tema}`, () => {
            for (const [texto, fondo] of PARES) {
                it(`${texto} sobre ${fondo} ≥ 4.5:1`, () => {
                    const razon = contraste(tokens[texto], tokens[fondo]);
                    expect(razon).toBeGreaterThanOrEqual(4.5);
                });
            }
        });
    }

    it("la curva única §4.5 está definida como token", () => {
        expect(css).toContain("--curva: cubic-bezier(0.16, 1, 0.3, 1)");
    });

    it("prefers-reduced-motion apaga TODA animación del sistema", () => {
        expect(css).toContain("@media (prefers-reduced-motion: reduce)");
        expect(css).toContain("animation: none !important");
        expect(css).toContain("transition: none !important");
    });

    it("el vidrio del sistema usa saturate(185%) blur(22px) (§4.6)", () => {
        expect(css).toContain("saturate(185%) blur(22px)");
    });
});

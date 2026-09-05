/**
 * SPEC-460 · El acento por territorio — `--accent` por rol.
 *
 * El Button del Sistema de Diseño (SPEC-454) lee `--accent`; esta spec lo
 * enciende por territorio: ámbar-ink (IDC/admin) · pino (colegio) · cielo
 * (padre + profesional). El mecanismo: un triplet `--accent-rgb` por tema
 * (.theme-*) alimenta la familia Tailwind `accent` (con alpha) y el color
 * `--accent` que consume el Button.
 *
 * Candado por CONDUCTA en dos capas:
 *  (1) globals.css declara `--accent-rgb` por tema con el color correcto y
 *      `--accent` derivado; la familia Tailwind lee `--accent-rgb` (no pino fijo).
 *  (2) cada layout de rol aplica su clase de tema.
 * jsdom no computa la cascada de CSS vars por clase, así que se verifica leyendo
 * los archivos. Verificado por mutación: cambiar el color de un tema, quitar la
 * var, o sacar la clase del layout mata el candado correspondiente.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const raiz = resolve(__dirname, "../..");
const css = readFileSync(resolve(raiz, "app/globals.css"), "utf-8");
const tw = readFileSync(resolve(raiz, "../tailwind.config.ts"), "utf-8");

function leer(rel: string): string {
    return readFileSync(resolve(raiz, rel), "utf-8");
}

/** Extrae el cuerpo `{...}` de la primera regla cuyo selector es exactamente `.theme-x`. */
function bloqueVar(tema: string): string {
    const re = new RegExp(`\\.${tema}\\s*\\{([^}]*)\\}`);
    return css.match(re)?.[1] ?? "";
}

describe("SPEC-460 · --accent por territorio (globals.css)", () => {
    it(":root declara el default (pino) y el color derivado --accent", () => {
        const root = css.slice(css.indexOf(":root"));
        expect(root).toMatch(/--accent-rgb:\s*var\(--pino-rgb\)/);
        expect(root).toMatch(/--accent:\s*rgb\(var\(--accent-rgb\)\)/);
    });

    it("cada tema fija --accent-rgb al color de su rol", () => {
        expect(bloqueVar("theme-colegio")).toMatch(/--accent-rgb:\s*var\(--pino-rgb\)/);
        expect(bloqueVar("theme-padre")).toMatch(/--accent-rgb:\s*var\(--cielo-rgb\)/);
        expect(bloqueVar("theme-admin")).toMatch(/--accent-rgb:\s*var\(--ambar-ink-rgb\)/);
        expect(bloqueVar("theme-profesional")).toMatch(/--accent-rgb:\s*var\(--cielo-rgb\)/);
    });

    it("admin usa ámbar-ink (contraste), NO ámbar crudo — §3.1", () => {
        // El acento de admin no puede ser el ámbar de 3.69:1; debe ser ámbar-ink.
        expect(bloqueVar("theme-admin")).not.toMatch(/--accent-rgb:\s*var\(--ambar-rgb\)/);
        expect(bloqueVar("theme-admin")).toMatch(/--accent-rgb:\s*var\(--ambar-ink-rgb\)/);
    });
});

describe("SPEC-460 · la familia Tailwind `accent` sigue --accent-rgb", () => {
    it("accent-500 resuelve --accent-rgb (no --pino-rgb fijo)", () => {
        const bloque = tw.slice(tw.indexOf("accent:"), tw.indexOf("accent:") + 400);
        expect(bloque).toContain("--accent-rgb");
        expect(bloque).not.toContain("--pino-rgb");
    });
});

describe("SPEC-460 · cada layout aplica su tema", () => {
    const casos: Array<[string, string]> = [
        ["dashboard/admin/layout.tsx", "theme-admin"],
        ["dashboard/colegio/layout.tsx", "theme-colegio"],
        ["dashboard/padre/layout.tsx", "theme-padre"],
        ["dashboard/profesional/layout.tsx", "theme-profesional"],
    ];
    for (const [ruta, tema] of casos) {
        it(`${ruta} monta ${tema}`, () => {
            expect(leer(`app/${ruta}`)).toContain(tema);
        });
    }
});

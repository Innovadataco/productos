/**
 * CANDADO · SPEC-876 (barrido de contraste · CLASE B) · `text-subtle` NO va sobre fondo TEÑIDO.
 *
 * Medido (FORMA-BARRIDO-CONTRASTE-TEXTO): `text-subtle` (#646a68) pasa AA sobre papel/blanco plano
 * (4.85/5.52) pero CAE a 3.96–4.48 sobre cualquier tinte (`bg-tinta/5+`, `bg-<acento>/10+`) → falla AA 4.5
 * para texto chico (<18px). `text-muted` (#4d5552) pasa en TODO (≥5.5). Por eso: un elemento que lleva un
 * relleno teñido en su className NO debe fijar también `text-subtle` como color de texto (lo heredaría el
 * texto chico de adentro, ilegible). Usar `text-muted`. En oscuro todo pasa; esto es claro-only, pero la
 * regla es theme-invariante (text-muted no empeora oscuro).
 *
 * ESTRUCTURAL (no render): escanea los className de `src/` y falla si un mismo className combina un
 * `bg-<tinta|acento>/N` con `text-subtle`. Muere con el defecto (el marcador «Nº de seguimiento» de 864 y
 * los demás de la lista); una regresión futura que vuelva a poner `text-subtle` sobre un tinte lo reenciende.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const RAIZ = resolve(__dirname, "..");
const TINTE = /\bbg-(?:tinta|cielo|ambar|pino|rubi|acento)\/\d/;
const SUBTLE = /\btext-subtle\b/;

function archivosTsx(dir: string): string[] {
    const out: string[] = [];
    for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) {
            if (e === "node_modules" || e === ".next") continue;
            out.push(...archivosTsx(p));
        } else if (e.endsWith(".tsx") && !e.includes(".test.")) {
            out.push(p);
        }
    }
    return out;
}

/** Extrae los class-lists de un archivo: `className="..."` y `className={`...`}` (hasta la 1ª interpolación). */
function classLists(src: string): string[] {
    const out: string[] = [];
    for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        out.push(m[1] ?? m[2] ?? "");
    }
    return out;
}

describe("SPEC-876 · text-subtle no va sobre fondo teñido (CLASE B)", () => {
    it("ningún className combina un relleno teñido con text-subtle (usar text-muted)", () => {
        const violaciones: string[] = [];
        for (const archivo of archivosTsx(RAIZ)) {
            const src = readFileSync(archivo, "utf-8");
            for (const cls of classLists(src)) {
                // Las ramas de un ternario (`${cond ? "bg-tinta…" : "…text-subtle"}`) NO son co-locación: el
                // tinte y el subtle viven en alternativas EXCLUYENTES. Se quitan los `${…}` y se mira solo lo
                // estático. Así un tinte+subtle ESTÁTICO (el defecto real) se caza, y el ternario no es falso +.
                const estatico = cls.replace(/\$\{[^}]*\}/g, " ");
                if (TINTE.test(estatico) && SUBTLE.test(estatico)) {
                    violaciones.push(`${archivo.slice(RAIZ.length + 1)}: «${estatico.trim().replace(/\s+/g, " ").slice(0, 80)}»`);
                }
            }
        }
        expect(
            violaciones,
            `text-subtle sobre tinte (3.96–4.48 < 4.5 para texto chico) — usar text-muted:\n  ${violaciones.join("\n  ")}`,
        ).toEqual([]);
    });
});

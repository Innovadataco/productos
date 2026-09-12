import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * SPEC-659 / I-403 · CANDADO DE CONDUCTA del RELLENO del padre.
 *
 * Invariante (NO lista): en el área del padre, el relleno de una acción primaria
 * sale de la TUBERÍA DEL ACENTO (cielo por tema / `<Button variant="primary">`),
 * **nunca de un `bg-pino` literal a mano**. Un `bg-pino` crudo como relleno de un
 * Link/botón esquiva la tubería de SPEC-661 y le pinta al padre el color
 * equivocado. El defecto reapareció CINCO veces persiguiendo ocurrencias una por
 * una (dos originales + dos en paralelo + AQuienProtejoView); un candado que
 * ENUMERA pantallas enumera mal mañana. Este cierra por conducta: cualquier
 * elemento interactivo del padre con `bg-pino`/`border-pino` SÓLIDO de acento cae,
 * sin base ni lista — tanto el relleno ESTÁTICO (`className="…bg-pino…"`) como el
 * acento CONDICIONAL por estado (`className={activo ? "border-pino bg-pino…" : …}`:
 * el seleccionado de un toggle; Diseño decidió que el seleccionado del padre sigue
 * el acento en cielo, I-403). Escanea el atributo de apertura entero del elemento.
 *
 * La distinción es ESTRUCTURAL, no de palabras — deja fuera, a propósito, tres cosas
 * que comparten el lexema «pino» pero no son el acento de acción:
 *  · El pino SEMÁNTICO (estado): badges «Activo»/«Sin novedades»/riesgo bajo y los
 *    puntos usan `bg-pino/10` (OPACIDAD) o aplican `bg-pino` por VARIABLE de un mapa
 *    de config sobre un `<span>`/`<div>` — el literal no vive en la etiqueta, así que
 *    no cae (SemaforoItem VERDE queda intacto).
 *  · Las pseudo-clases de interacción `focus:`/`hover:` (p. ej. `focus:border-pino`
 *    de un `<input>`): es el carril del FOCO (SPEC-662), no el relleno/seleccionado.
 *    Excluidas por el prefijo `:`.
 *  · `text-pino` (acento como TEXTO): adyacente a I-406, su propia ficha.
 *
 * Muere por MUTACIÓN: un `<Link className="… bg-pino …">` o un toggle que vuelva a
 * `activo ? "border-pino bg-pino…"` lo pone ROJO. fs + parseo de texto → unit, sin BD.
 */

const SRC = path.resolve(__dirname, "..", "..", ".."); // .../src
const DIRS = ["components/modules/padre", "app/dashboard/padre"].map((d) => path.join(SRC, d));
const TAGS = ["<Link", "<Button", "<button", "<a"];
// `bg-pino`/`border-pino` como utilidad BASE (el acento de relleno/seleccionado).
// Excluye: la opacidad `…-pino/10` (velo semántico) por `(?![\w/-])`, y las pseudo-clases
// `focus:`/`hover:`/responsive `sm:` (foco, SPEC-662) por el lookbehind `(?<![\w:-])`.
const ACENTO_PINO_SOLIDO = /(?<![\w:-])(?:bg|border)-pino(?![\w/-])/;

function fuentes(): { rel: string; src: string }[] {
    const out: { rel: string; src: string }[] = [];
    const stack = [...DIRS];
    while (stack.length) {
        const dir = stack.pop()!;
        if (!fs.existsSync(dir)) continue;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const ruta = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (e.name === "node_modules" || e.name === ".next") continue;
                stack.push(ruta);
            } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
                out.push({ rel: path.relative(SRC, ruta), src: fs.readFileSync(ruta, "utf-8") });
            }
        }
    }
    return out;
}

// Fin de la etiqueta de apertura: primer '>' a profundidad 0 de llaves y fuera de
// comillas (así `onClick={() => f()}` no confunde con su '>').
function finEtiqueta(src: string, desde: number): number {
    let depth = 0;
    let quote = "";
    for (let j = desde; j < src.length; j++) {
        const c = src[j];
        if (quote) {
            if (c === quote) quote = "";
        } else if (c === '"' || c === "'" || c === "`") quote = c;
        else if (c === "{") depth++;
        else if (c === "}") depth--;
        else if (c === ">" && depth === 0) return j;
    }
    return src.length;
}

// Elementos INTERACTIVOS del padre cuyo className LITERAL trae `bg-pino` sólido.
function rellenosPinoCrudo(rel: string, src: string): string[] {
    const out: string[] = [];
    for (const tag of TAGS) {
        let i = 0;
        while ((i = src.indexOf(tag, i)) !== -1) {
            const tras = src[i + tag.length];
            // `<a` solo si es la etiqueta anchor (sigue espacio/salto/`>`), no `<article`/`<aside`.
            if (tag === "<a" && tras !== undefined && !/[\s>/]/.test(tras)) {
                i += tag.length;
                continue;
            }
            const fin = finEtiqueta(src, i + tag.length);
            const attrs = src.slice(i + tag.length, fin);
            // Todo el atributo de apertura: estático (`className="…bg-pino…"`) Y
            // condicional (`className={activo ? "border-pino bg-pino…" : …}`). El
            // literal DEBE estar en la etiqueta — la indirección por variable (mapa
            // de config) no trae el lexema acá, así que no cae.
            if (ACENTO_PINO_SOLIDO.test(attrs)) {
                out.push(`${rel} :: ${tag} ${attrs.replace(/\s+/g, " ").trim().slice(0, 80)}…`);
            }
            i = fin + 1;
        }
    }
    return out;
}

describe("SPEC-659 / I-403 · el relleno del padre sale de la tubería del acento, no de bg-pino a mano", () => {
    it("ningún elemento interactivo del padre pinta `bg-pino` SÓLIDO de relleno", () => {
        const hits = fuentes().flatMap((f) => rellenosPinoCrudo(f.rel, f.src));
        expect(
            hits,
            [
                "SPEC-659/I-403 — relleno pino a mano en una acción del padre:",
                ...hits.map((h) => "  " + h),
                "",
                "El relleno del primario sale de la tubería del acento: usá `bg-cielo text-acento-ink`",
                "(o `<Button variant=\"primary\">`), NUNCA `bg-pino` literal — reintroduce el acento",
                "equivocado (I-403). El pino SEMÁNTICO (estado: badges «Activo»/«Sin novedades», puntos)",
                "va con opacidad (`bg-pino/10`) o por variable sobre un <span>/<div>: eso NO es relleno",
                "de acción y este candado no lo toca.",
            ].join("\n"),
        ).toEqual([]);
    });
});

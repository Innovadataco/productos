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
 * elemento interactivo del padre con `bg-pino` SÓLIDO cae, sin base ni lista.
 *
 * Mira SOLO el relleno ESTÁTICO/incondicional: `className="…"` (string literal)
 * de un elemento interactivo. Eso es el relleno del primario. Deja fuera, a
 * propósito, dos cosas que NO son este defecto:
 *  · El pino SEMÁNTICO (estado): badges «Activo»/«Sin novedades»/riesgo bajo y los
 *    puntos usan `bg-pino/10` (opacidad) o aplican `bg-pino` por VARIABLE de un
 *    mapa de config sobre un `<span>`/`<div>` — SemaforoItem VERDE queda intacto.
 *  · El `className={…}` CONDICIONAL por estado (toggles/chips de control segmentado,
 *    p. ej. `activo ? "bg-pino…" : …`) — es OTRO carril (SPEC-633), no el relleno
 *    del primario. Un `={…}` no es un `="…"`, así que no lo caza.
 *
 * Muere por MUTACIÓN: un `<Link className="… bg-pino …">` (o `<a>`/`<button>`) en
 * el árbol del padre lo pone ROJO. fs + parseo de texto → unit, sin base de datos.
 */

const SRC = path.resolve(__dirname, "..", "..", ".."); // .../src
const DIRS = ["components/modules/padre", "app/dashboard/padre"].map((d) => path.join(SRC, d));
const TAGS = ["<Link", "<Button", "<button", "<a"];
// Sólido = el acento de relleno; `bg-pino/10` (opacidad) es el velo SEMÁNTICO y se permite.
const BG_PINO_SOLIDO = /\bbg-pino\b(?!\/)/;

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
            // Solo el relleno ESTÁTICO: `className="…"` (string literal). Un
            // `className={…}` (ternario por estado: toggles/control segmentado) es
            // otro carril (SPEC-633), no el relleno del primario de I-403.
            const m = attrs.match(/className\s*=\s*"([^"]*)"/);
            if (m && BG_PINO_SOLIDO.test(m[1])) {
                out.push(`${rel} :: ${tag} className="…${m[1].replace(/\s+/g, " ").trim().slice(0, 60)}…"`);
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

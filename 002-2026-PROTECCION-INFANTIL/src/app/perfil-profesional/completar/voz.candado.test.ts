/**
 * SPEC-434 (I-302 · Jelkin vivo 04-09) · Candado de voz para
 * `perfil-profesional/completar/page.tsx`. Voz de Colombia — usted formal,
 * SIN voseo. Alinea con el módulo de colegio (barrido I-250).
 *
 * El ratchet lee la pantalla y falla si aparecen verbos en voseo. La lista
 * es la que trajo el radicado + los sospechosos habituales; si mañana entra
 * un verbo en voseo nuevo, se agrega acá y el radicado dirá dónde apareció.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const RUTA_PAGE = path.resolve(__dirname, "page.tsx");

/**
 * Elimina bloques y líneas de comentarios (aprox.) para no cazar la
 * documentación del componente ni descripciones del propósito ("completa
 * su ficha" en el JSDoc no es voseo, es una descripción neutra).
 */
function sinComentarios(codigo: string): string {
    return codigo
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * SPEC-504 (radicado CEO · hallazgo Dev 1, 05-09) · Verbos en voseo, versiones
 * EXACTAS. El borde de palabra usa **letra Unicode** `(?<![\p{L}])…(?![\p{L}])`
 * con flag `u`, NO `\b` ASCII.
 *
 * Por qué: el `\b` ASCII NO cierra contra **vocal acentuada final** (á/é/í): entre
 * la vocal acentuada (no-word en ASCII) y el espacio/puntuación siguiente no hay
 * transición word↔non-word, así que `\belegí\b`, `\bcontá\b`, `\bSubí\b` estaban
 * **MUERTOS** — nunca disparaban y el candado pasaba CON el defecto puesto (peor
 * que ninguno). Los presentes `-és/-ás` sobrevivían (cierran en `s`, ASCII), pero
 * todo imperativo/enclítico acabado en vocal acentuada moría.
 *
 * El borde Unicode dispara en «Elegí»/«Contá»/«Subí» y a la vez NO caza por
 * subcadena («subió», «revisándolo»). Verificado por mutación (voseo → rojo).
 */
const B = "(?<![\\p{L}])";
const E = "(?![\\p{L}])";
function vos(lexema: string): RegExp {
    return new RegExp(B + lexema + E, "iu");
}
const LEXEMAS_VOSEO = [
    "completá", "querés", "tenés", "podés", "sabés", "vivís", "sos",
    "subí", "contá", "dale", "terminés", "subás", "elegí",
];
const PATRONES_VOSEO: Array<{ patron: RegExp; ejemplo: string }> = LEXEMAS_VOSEO.map(
    (lexema) => ({ patron: vos(lexema), ejemplo: lexema }),
);

describe("SPEC-434 · voz Colombia (sin voseo) en /perfil-profesional/completar", () => {
    it("la pantalla existe (contraprueba del scanner)", () => {
        expect(fs.existsSync(RUTA_PAGE)).toBe(true);
    });

    it("ningún verbo en voseo aparece en la pantalla (comentarios excluidos)", () => {
        const codigo = sinComentarios(fs.readFileSync(RUTA_PAGE, "utf-8"));
        const hits: string[] = [];
        for (const { patron, ejemplo } of PATRONES_VOSEO) {
            const matches = codigo.match(patron);
            if (matches) {
                hits.push(`«${ejemplo}» (patrón ${patron}): «${matches[0]}»`);
            }
        }
        expect(
            hits,
            [
                "SPEC-434 (I-302) — voseo en la pantalla del profesional:",
                ...hits,
                "",
                "Voz de Colombia = usted formal. Cambie el verbo por su forma",
                "en usted; si es un caso legítimo (nombre de var, string sin",
                "traducir), agregue una excepción explícita al ratchet.",
            ].join("\n"),
        ).toEqual([]);
    });
});

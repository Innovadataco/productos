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
 * Verbos en voseo — versiones EXACTAS con acento agudo final. Es la marca
 * inequívoca del voseo (sin ambigüedad con conjugaciones neutras). Un
 * patrón como `sub[íi]` daría falso positivo con «subió» (formal, tercera
 * persona) por el borde ASCII de `\b` frente a `ó`.
 */
const PATRONES_VOSEO: Array<{ patron: RegExp; ejemplo: string }> = [
    { patron: /\b[Cc]ompletá\b/, ejemplo: "Completá" },
    { patron: /\bquerés\b/i, ejemplo: "querés" },
    { patron: /\btenés\b/i, ejemplo: "tenés" },
    { patron: /\bpodés\b/i, ejemplo: "podés" },
    { patron: /\bsabés\b/i, ejemplo: "sabés" },
    { patron: /\bvivís\b/i, ejemplo: "vivís" },
    { patron: /\bsos\b/, ejemplo: "sos" },
    { patron: /\bSubí\b/, ejemplo: "Subí" },
    { patron: /\bcontá\b/i, ejemplo: "contá" },
    { patron: /\bdale\b/i, ejemplo: "dale" },
    { patron: /\bterminés\b/i, ejemplo: "terminés" },
    { patron: /\bsubás\b/i, ejemplo: "subás" },
    { patron: /\belegí\b/i, ejemplo: "elegí" },
];

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

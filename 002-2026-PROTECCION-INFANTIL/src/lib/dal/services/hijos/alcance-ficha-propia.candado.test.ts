/**
 * SPEC-669 · CANDADO de CLASE: el servicio del padre no afirma (en PRESENTE) que
 * los datos por-ficha del menor sean COMPARTIDOS/GLOBALES entre los dos padres.
 *
 * Contexto: SPEC-339 (D-4, 31-08) hizo la ficha PROPIA de cada padre
 * (`Hijo.usuarioId`, sus interruptores y sus avisos). El modelo "compartido" que
 * existía antes se ELIMINÓ. Pero varios comentarios/docblocks siguieron
 * afirmándolo en PRESENTE — y eso costó caro (I-394: cuatro personas le creyeron
 * a un comentario muerto; `hijos.ts` decía «El identificador es compartido entre
 * los dos padres», falso desde D-4). Un texto que afirma un alcance que el modelo
 * ya no tiene es una trampa cargada: el próximo lo cree.
 *
 * Este candado NO ancla en una frase literal (no es "leer el texto"): vigila la
 * CLASE — cualquier afirmación en PRESENTE de alcance compartido/global sobre las
 * entidades por-ficha (identificador, ficha, cuenta, estado, interruptor) en el
 * servicio del padre. Muere con el defecto: reintroducir esa clase, con cualquier
 * redacción del patrón, lo pone rojo.
 *
 * EXENTO a propósito (no es la clase):
 *  - Historia en PASADO (era/antes/quedaban/eliminó): describe lo que D-4 quitó.
 *  - El MECANISMO de monitoreo (candado 22): el valor canónico SÍ cruza reportes
 *    de todos los que vigilan esa cuenta — eso es compartido y verdadero.
 *
 * Límite confesado: es un candado de PROSA sobre un conjunto de patrones; una
 * redacción nueva del alcance compartido fuera del patrón podría pasar. Cubre las
 * formas conocidas de la clase (I-394), no toda frase concebible.
 *
 * fs puro → unit, sin base.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const HIJOS_TS = path.join(__dirname, "hijos.ts");

// Marcadores de PASADO: la línea describe el modelo que D-4 eliminó, no el actual.
// Stems ASCII (escrib, elimin, derog) para no depender de acentos en \b.
const PASADO = /(\bantes\b|\bera\b|\beran\b|quedaba|escrib|reescrib|elimin|derog|\bya no\b)/i;
// El mecanismo de monitoreo SÍ es compartido (verdadero): se exime.
const MECANISMO = /(mecanismo|monitoreo|apagador)/i;

// La CLASE: afirmación de alcance compartido/global sobre lo por-ficha.
const ALCANCE_COMPARTIDO: RegExp[] = [
    /\bes\s+compartid[oa]\b/i,
    /\bson\s+compartid[oa]s\b/i,
    /\bflag\s+global\b/i,
    /\bafecta\s+a\s+ambos\b/i,
    /\bentre\s+los\s+dos\s+padres\b/i,
    /\bde\s+ambos\s+padres\b/i,
    // Guardado contra la negación: «afecta al otro padre» (falso) SÍ; «NO afecta
    // al otro padre» (la verdad post-D-4) NO — es la afirmación opuesta.
    /(?<!\bno\s)(aplica|afecta)\s+(a|al)\s+(ambos|otro\s+padre)\b/i,
];

describe("SPEC-669 · el servicio del padre no afirma alcance compartido (ficha propia · D-4)", () => {
    it("hijos.ts: ninguna afirmación EN PRESENTE de dato por-ficha compartido/global", () => {
        const lineas = fs.readFileSync(HIJOS_TS, "utf-8").split("\n");
        const ofensas: string[] = [];
        lineas.forEach((linea, i) => {
            if (PASADO.test(linea) || MECANISMO.test(linea)) return; // exento
            if (ALCANCE_COMPARTIDO.some((re) => re.test(linea))) {
                ofensas.push(`hijos.ts:${i + 1}  ${linea.trim()}`);
            }
        });
        expect(
            ofensas,
            "afirmación(es) EN PRESENTE de alcance compartido/global — la ficha es PROPIA por D-4. " +
                "Reformule al alcance real (local a este padre); si habla del PASADO o del MECANISMO de " +
                "monitoreo, ese lenguaje ya está exento:\n" +
                ofensas.join("\n"),
        ).toEqual([]);
    });
});

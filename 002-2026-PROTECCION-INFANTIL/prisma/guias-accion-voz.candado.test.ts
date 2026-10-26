/**
 * SPEC-908 · CANDADO de VOZ de las 8 Guías de Acción: tú (tuteo), SIN voseo.
 *
 * La guía es recurso público/del adulto responsable → tú, nunca voseo (D-107). Este
 * candado muere con el defecto: si una guía del contenido canónico (`GUIAS_ACCION_BASE`,
 * la MISMA fuente que seed y corrector) trae una forma voseo, se pone en ROJO.
 *
 * Detector por MORFOLOGÍA (no por una lista de verbos voseo prohibidos):
 *   - Imperativo afirmativo voseo: la palabra TERMINA en vocal acentuada final -á/-é/-í
 *     (documentá, bloqueá, hacé, pedí). La forma TÚ lleva el acento en otra sílaba o no
 *     lo lleva (documenta, bloquea, hace, pide) → NO cae en el patrón: tú PASA siempre.
 *   - Subjuntivo/negativo voseo: la palabra TERMINA en -és (no bloqueés, no interrogués,
 *     no actués). El subjuntivo TÚ es -es sin tilde (no bloquees) → PASA.
 *   - Los pretéritos de 3ª (-ó/-ió: «compartió», «publicó») NO se tocan: no se apunta a -ó/-ú.
 *
 * El LADO QUE PROHÍBE es morfológico: CUALQUIER verbo voseo nuevo (tenés, configurá…)
 * cae por terminación, no por estar en una lista. El LADO QUE PERMITE sí nombra sus
 * excepciones —nombres propios/legales y formas no-voseo que comparten terminación
 * (3ª persona «está», sustantivos «comité», interrogativo «qué», adverbios, -és de
 * sustantivo)— porque Diseño lo pidió explícito: «deje pasar nombres propios/legales».
 * Como el contenido es ACOTADO (8 guías), el set de excepciones es cerrado y auditable;
 * un token nuevo con vocal acentuada final que NO sea voseo y no esté en el set pone el
 * candado en rojo (falla-cerrado): obliga a clasificarlo a conciencia. Eso es deseable.
 *
 * Verificado por CONTROL POSITIVO (abajo): el detector dispara sobre un voseo sintético
 * y da cero sobre su equivalente en tú y sobre las excepciones; y por MUTACIÓN: reinyectar
 * un voseo en una guía la pone en rojo. Un candado que pasa con el defecto es peor que ninguno.
 */
import { describe, it, expect } from "vitest";
import { GUIAS_ACCION_BASE, type GuiaAccionSeed } from "./guias-accion.seed-data";

// Borde de letra Unicode: el `\b` ASCII muere contra vocal acentuada.
const B = "(?<![\\p{L}])";
const E = "(?![\\p{L}])";
// Imperativo afirmativo voseo: palabra que termina en vocal acentuada final á/é/í.
const IMPERATIVO_VOSEO = new RegExp(B + "\\p{L}+(?:á|é|í)" + E, "giu");
// Subjuntivo/negativo voseo: palabra que termina en -és.
const SUBJUNTIVO_VOSEO = new RegExp(B + "\\p{L}+és" + E, "giu");

/**
 * Formas NO-voseo que comparten terminación acentuada con el voseo y deben PASAR.
 * El lado que prohíbe sigue siendo morfológico; esto es el allowlist de excepciones que
 * Diseño sancionó (nombres propios/legales + 3ª persona/sustantivos/adverbios). Comparación
 * en minúsculas y sin distinguir el token exacto. Si entra una palabra nueva con vocal
 * acentuada final que NO es voseo, se agrega acá con justificación (no se castiga tú).
 */
const EXCEPCIONES_NO_VOSEO = new Set<string>([
    // 3ª persona presente / verbos irregulares de 1 sílaba (no son imperativo voseo).
    "está", "sé", "dé",
    // Interrogativos / relativos.
    "qué", "porqué",
    // Sustantivos y nombres propios/legales que terminan en vocal acentuada.
    "comité", "café", "bebé", "josé", "bogotá", "panamá",
    // Adverbios / demostrativos.
    "acá", "allá", "aquí", "ahí", "allí", "así", "quizá", "ojalá",
    // -és de sustantivo/adjetivo/adverbio (no subjuntivo voseo).
    "después", "interés", "través", "cortés", "inglés", "francés", "revés", "estrés", "ciempiés",
]);

export interface HitVoz {
    categoria: string;
    campo: string;
    forma: string;
    texto: string;
}

/** Devuelve los tokens voseo de un texto (ya descontadas las excepciones no-voseo). */
export function detectarVoseo(texto: string): string[] {
    const hits: string[] = [];
    for (const patron of [IMPERATIVO_VOSEO, SUBJUNTIVO_VOSEO]) {
        for (const m of texto.matchAll(patron)) {
            const token = m[0];
            if (!EXCEPCIONES_NO_VOSEO.has(token.toLowerCase())) hits.push(token);
        }
    }
    return hits;
}

/** Todas las cadenas con voz de una guía, con el nombre del campo para el reporte. */
function cadenasDeVoz(g: GuiaAccionSeed): Array<{ campo: string; texto: string }> {
    const out: Array<{ campo: string; texto: string }> = [
        { campo: "tituloEmocional", texto: g.tituloEmocional },
        { campo: "subtitulo", texto: g.subtitulo },
        { campo: "categoriaBadgeTexto", texto: g.categoriaBadgeTexto },
        { campo: "calloutTitulo", texto: g.calloutTitulo },
        { campo: "calloutTexto", texto: g.calloutTexto },
        { campo: "piePagina", texto: g.piePagina },
    ];
    for (const p of g.pasos) {
        out.push({ campo: `paso ${p.orden} · título`, texto: p.titulo });
        out.push({ campo: `paso ${p.orden} · descripción`, texto: p.descripcion });
    }
    for (const b of g.botones) {
        out.push({ campo: "botón · texto", texto: b.texto });
        if (b.subtexto) out.push({ campo: "botón · subtexto", texto: b.subtexto });
    }
    return out;
}

function barrer(guias: GuiaAccionSeed[]): HitVoz[] {
    const hits: HitVoz[] = [];
    for (const g of guias) {
        for (const { campo, texto } of cadenasDeVoz(g)) {
            for (const forma of detectarVoseo(texto)) {
                hits.push({ categoria: g.categoria, campo, forma, texto });
            }
        }
    }
    return hits;
}

describe("SPEC-908 · las 8 Guías de Acción hablan de «tú» (sin voseo)", () => {
    it("control POSITIVO: el detector dispara con voseo y da cero con tú", () => {
        // Un voseo sintético (imperativo -á/-í + subjuntivo -és) debe dar hits...
        expect(detectarVoseo("Documentá y bloqueá; no interrogués a la persona menor.").length).toBeGreaterThan(0);
        expect(detectarVoseo("Pedí ayuda y reforzá la seguridad.").length).toBeGreaterThan(0);
        // ...y su equivalente EXACTO en tú debe pasar limpio (tú no se castiga).
        expect(detectarVoseo("Documenta y bloquea; no interrogues a la persona menor.")).toEqual([]);
        expect(detectarVoseo("Pide ayuda y refuerza la seguridad.")).toEqual([]);
    });

    it("excepciones: 3ª persona, sustantivos, nombres propios/legales PASAN", () => {
        expect(detectarVoseo("Si alguien está construyendo confianza para dañar")).toEqual([]);
        expect(detectarVoseo("Contacta al comité de convivencia")).toEqual([]);
        expect(detectarVoseo("¿Por qué no bloquear de inmediato?")).toEqual([]);
        expect(detectarVoseo("Fiscalía, Policía Judicial, Gaula, CAI, Ley 2196 de 2022")).toEqual([]);
        // 3ª persona de pretérito -ó/-ió no es voseo y no se apunta.
        expect(detectarVoseo("quién lo compartió y cuándo; dónde se publicó")).toEqual([]);
    });

    it("hay contenido que vigilar (las 8 guías con sus campos)", () => {
        expect(GUIAS_ACCION_BASE.length).toBe(8);
        const totalCadenas = GUIAS_ACCION_BASE.reduce((n, g) => n + cadenasDeVoz(g).length, 0);
        expect(totalCadenas).toBeGreaterThan(80);
    });

    it("contraprueba por MUTACIÓN: un voseo reinyectado en una guía la pone en rojo", () => {
        const mutada: GuiaAccionSeed = {
            ...GUIAS_ACCION_BASE[0],
            pasos: [{ orden: 1, tipo: "ACCION", titulo: "Documentá la evidencia", descripcion: "No bloqueés el contacto." }],
        };
        expect(barrer([mutada]).length).toBeGreaterThan(0);
    });

    it("cero voseo en el contenido canónico de las 8 guías", () => {
        const hits = barrer(GUIAS_ACCION_BASE);
        expect(
            hits.map((h) => `${h.categoria} · ${h.campo} → «${h.forma}»: ${h.texto.slice(0, 90)}`),
            [
                "SPEC-908 — voseo en el contenido de una Guía de Acción:",
                "La guía habla de «tú» (D-107). Pasá el verbo a su forma en tú:",
                "documentá→documenta, bloqueá→bloquea, pedí→pide, no bloqueés→no bloquees.",
                "Si es un token legítimo con vocal acentuada final (nombre propio/legal,",
                "3ª persona), agregalo a EXCEPCIONES_NO_VOSEO con justificación. NO migres a",
                "usted ni a voseo: el adulto responsable tutea.",
            ].join("\n"),
        ).toEqual([]);
    });
});

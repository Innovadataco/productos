/**
 * CANDADO · SPEC-753/784 — la ESTRUCTURA y la CONDUCTA de las preguntas de servicio, NO su prosa.
 *
 * La redacción visible es autoridad de Diseño (D-3) y se MUEVE (BORRADOR [ABOGADO]-pendiente). Un
 * candado que se ponía rojo por una mejora legítima de copy es un candado que alguien termina borrando
 * —y con él se van las invariantes que sí importan—. Por eso este candado, reescrito (veredicto CEO):
 *
 *  · PINEA la ESTRUCTURA (no puede cambiar sin migración o sin romper el cruce): las 5 preguntas y su
 *    ORDEN · las `key` cerradas por pregunta · las 4 razones · «Otra» sin campo de texto · el fallback
 *    de `etiquetaOpcion` · el eje de audiencia (una sola opción role-relative).
 *  · DEJA de pinear la prosa (enunciados y labels exactos).
 *  · VIGILA la conducta que la estructura NO garantiza — el `[NORMA]` de que las preguntas son de
 *    SERVICIO y NO clínicas — por MORFOLOGÍA (la FORMA de lo prohibido: el menor como sujeto, lo que se
 *    habló, síntomas/estado), no por lista de frases (una lista la esquiva cualquier redacción nueva).
 *
 * Unit puro, sin BD. (La PARIDAD keys↔enums vive en `encuestas-preguntas-enums.candado.test.ts`.)
 */
import { describe, it, expect } from "vitest";
import {
    PREGUNTAS_SERVICIO,
    RAZONES_NO_REALIZO,
    RAZON_NO_REALIZO_ENUNCIADO,
    opcionesValidas,
    etiquetaOpcion,
    labelOpcion,
} from "@/lib/profesional/cita/encuestas-preguntas";

// ── Morfología de lo PROHIBIDO ([NORMA]: servicio, no clínico) ────────────────────────────────────
// Normaliza (sin acentos, minúsculas) y busca la FORMA de una pregunta clínica/de contenido, no frases
// exactas. Las 6 preguntas de servicio son mecánicas (ocurrió · por qué no · operador · comenzó ·
// enlace · duración) y NUNCA nombran al menor ni preguntan qué se habló.
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MORFOLOGIA_CLINICA: readonly RegExp[] = [
    /\b(nin[oa]|menor|hij[oa]|paciente|chic[oa])/, // el menor como SUJETO de la pregunta
    /\bde que\b/, // «¿de qué hablaron/se trató…?»
    /\bque (se )?(hablo|hablaron|converso|conversaron|dijo|dijeron|conto|contaron|trato|trataron|discutio|discutieron)\b/,
    /\b(tema|contenido|conversacion|relato)/, // el contenido de la sesión
    /\b(sintoma|diagnostic|emocion|animo|psicologic|terapeutic|sentimiento|se siente|se sintio|como esta|como sigue|como se encuentra|salud mental|bienestar)/, // estado clínico/emocional
];
const pareceContenidoClinico = (texto: string) => MORFOLOGIA_CLINICA.some((re) => re.test(norm(texto)));

const CLAVES_OPCION_PERMITIDAS = new Set(["key", "label", "labelPorAudiencia"]);

describe("SPEC-753/784 · ESTRUCTURA de las preguntas de servicio (no la prosa)", () => {
    it("son las 5 preguntas, en ORDEN", () => {
        expect(PREGUNTAS_SERVICIO.map((p) => p.pregunta)).toEqual([
            "SE_REALIZO",
            "OPERADOR",
            "INICIO",
            "ENLACE",
            "DURACION",
        ]);
    });

    it("cada pregunta tiene enunciado no vacío y sus `key` cerradas son el conjunto esperado", () => {
        for (const p of PREGUNTAS_SERVICIO) {
            expect(p.enunciado.trim().length, `enunciado vacío en ${p.pregunta}`).toBeGreaterThan(0);
        }
        expect(opcionesValidas("SE_REALIZO")).toEqual(["SI", "NO"]);
        expect(opcionesValidas("OPERADOR")).toEqual(["SI", "NO", "NO_HUBO_OPERADOR"]);
        expect(opcionesValidas("INICIO")).toEqual(["A_TIEMPO", "CON_RETRASO", "NO_COMENZO"]);
        expect(opcionesValidas("ENLACE")).toEqual(["SI", "CON_PROBLEMAS", "NO_FUNCIONO"]);
        expect(opcionesValidas("DURACION")).toEqual(["MENOS_15", "ENTRE_15_30", "ENTRE_30_45", "MAS_45"]);
    });

    it("las 4 razones del «No», en ORDEN, y «Otra» presente", () => {
        expect(RAZONES_NO_REALIZO.map((o) => o.key)).toEqual([
            "NO_ME_CONECTE",
            "OTRA_PARTE_NO_CONECTO",
            "PROBLEMA_TECNICO",
            "OTRA",
        ]);
    });

    it("CERO texto libre: cada opción es {key, label, labelPorAudiencia?} — ningún flag que abra un campo", () => {
        const todas = [...PREGUNTAS_SERVICIO.flatMap((p) => p.opciones), ...RAZONES_NO_REALIZO];
        for (const o of todas) {
            expect(o.key.trim().length, "key vacía").toBeGreaterThan(0);
            expect(o.label.trim().length, `label vacío en ${o.key}`).toBeGreaterThan(0);
            // Estructural: la opción NO puede llevar una propiedad que abra texto libre (p.ej. `abreTexto`).
            for (const clave of Object.keys(o)) {
                expect(CLAVES_OPCION_PERMITIDAS.has(clave), `la opción ${o.key} trae una propiedad no permitida: ${clave}`).toBe(true);
            }
        }
    });

    it("`etiquetaOpcion` resuelve el label del valor cerrado y NUNCA inventa texto (fallback = la key)", () => {
        // No pinea la prosa: sólo que devuelve ALGO no vacío para un valor conocido y la key para uno desconocido.
        expect(etiquetaOpcion("INICIO", "CON_RETRASO").length).toBeGreaterThan(0);
        expect(etiquetaOpcion("ENLACE", "VALOR_INEXISTENTE")).toBe("VALOR_INEXISTENTE");
    });

    it("EJE DE AUDIENCIA: `OTRA_PARTE_NO_CONECTO` es la ÚNICA role-relative (dos textos, mismo hecho)", () => {
        const roleRelative = [...PREGUNTAS_SERVICIO.flatMap((p) => p.opciones), ...RAZONES_NO_REALIZO].filter(
            (o) => o.labelPorAudiencia !== undefined,
        );
        expect(roleRelative.map((o) => o.key)).toEqual(["OTRA_PARTE_NO_CONECTO"]);
        const otraParte = RAZONES_NO_REALIZO.find((o) => o.key === "OTRA_PARTE_NO_CONECTO")!;
        expect(labelOpcion(otraParte, "PADRE")).not.toBe(labelOpcion(otraParte, "PROFESIONAL"));
        // Una opción NO role-relative se lee igual desde las dos sillas.
        const noRelative = RAZONES_NO_REALIZO.find((o) => o.key === "NO_ME_CONECTE")!;
        expect(labelOpcion(noRelative, "PADRE")).toBe(labelOpcion(noRelative, "PROFESIONAL"));
    });
});

describe("SPEC-753/784 · [NORMA] · las preguntas son de SERVICIO, no clínicas (morfología)", () => {
    it("NINGÚN enunciado ni label tiene la forma de una pregunta de contenido/estado del menor", () => {
        const textos = [
            ...PREGUNTAS_SERVICIO.flatMap((p) => [p.enunciado, ...p.opciones.map((o) => o.label)]),
            RAZON_NO_REALIZO_ENUNCIADO,
            ...RAZONES_NO_REALIZO.flatMap((o) => [o.label, ...(o.labelPorAudiencia ? Object.values(o.labelPorAudiencia) : [])]),
        ];
        for (const t of textos) {
            expect(pareceContenidoClinico(t), `texto con forma clínica/de contenido: "${t}"`).toBe(false);
        }
    });

    it("CONTROL POSITIVO: el detector SÍ marca preguntas clínicas/de contenido (no es vacuo)", () => {
        expect(pareceContenidoClinico("¿Cómo se sintió el niño en la sesión?")).toBe(true);
        expect(pareceContenidoClinico("¿De qué hablaron durante la cita?")).toBe(true);
        expect(pareceContenidoClinico("¿Qué síntomas presentó el menor?")).toBe(true);
        expect(pareceContenidoClinico("¿Cómo está el estado emocional del paciente?")).toBe(true);
        // Y NO marca una pregunta mecánica de servicio (control negativo).
        expect(pareceContenidoClinico("¿El enlace funcionó?")).toBe(false);
    });
});

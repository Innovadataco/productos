import { describe, it, expect } from "vitest";
import { payloadUnificadoSchema } from "./index";

/**
 * SPEC-146 (T001) — payloadUnificadoSchema: reusa los schemas de alta
 * (curso/estudiante/identificador) y añade las reglas del payload unido:
 * estudianteIndex válido y profesor existente XOR profesor nuevo.
 */

const CUID_1 = "clxxxxxxxxxxxxxxxxxxxxxx01";
const CUID_2 = "clxxxxxxxxxxxxxxxxxxxxxx02";

function payloadBase(override: Record<string, unknown> = {}) {
    return {
        curso: { nombre: "8° B", grado: "Octavo", anioLectivo: "2026" },
        // SPEC-320 (§2.2-bis): el documento del alumno es obligatorio en el payload.
        estudiantes: [
            { nombre: "María", apellidos: "Gómez Pérez", documentoTipo: "TI", documentoNumero: "1001" },
            { nombre: "Carlos", apellidos: "Ruiz Díaz", documentoTipo: "TI", documentoNumero: "1002" },
        ],
        identificadores: [
            { estudianteIndex: 0, valor: "+573001234567" },
            { estudianteIndex: 1, tipo: "email", valor: "carlos@example.com", etiquetaRelacion: "PADRE" },
        ],
        ...override,
    };
}

describe("payloadUnificadoSchema", () => {
    it("acepta un payload completo válido (identificador sin tipo se permite: se infiere en la ruta)", () => {
        const resultado = payloadUnificadoSchema.safeParse(payloadBase());
        expect(resultado.success).toBe(true);
        if (resultado.success) {
            expect(resultado.data.identificadores[0].tipo).toBeUndefined();
        }
    });

    it("acepta el curso solo (sin estudiantes ni identificadores)", () => {
        const resultado = payloadUnificadoSchema.safeParse(payloadBase({ estudiantes: [], identificadores: [] }));
        expect(resultado.success).toBe(true);
    });

    it("acepta profesorTitularId existente y, por separado, profesorNuevo", () => {
        const conExistente = payloadUnificadoSchema.safeParse(
            payloadBase({ curso: { nombre: "8° B", profesorTitularId: CUID_1 } })
        );
        expect(conExistente.success).toBe(true);

        const conNuevo = payloadUnificadoSchema.safeParse(
            payloadBase({ profesorNuevo: { nombre: "Ana", apellidos: "López" } })
        );
        expect(conNuevo.success).toBe(true);
    });

    it("rechaza profesorTitularId y profesorNuevo a la vez", () => {
        const resultado = payloadUnificadoSchema.safeParse(
            payloadBase({
                curso: { nombre: "8° B", profesorTitularId: CUID_1 },
                profesorNuevo: { nombre: "Ana", apellidos: "López" },
            })
        );
        expect(resultado.success).toBe(false);
        if (!resultado.success) {
            expect(resultado.error.issues[0].message).toContain("no ambos");
        }
    });

    it("rechaza un estudianteIndex que apunta fuera de la lista", () => {
        const resultado = payloadUnificadoSchema.safeParse(
            payloadBase({ identificadores: [{ estudianteIndex: 2, valor: "nick123" }] })
        );
        expect(resultado.success).toBe(false);
        if (!resultado.success) {
            expect(resultado.error.issues[0].message).toContain("no está en la lista");
        }
    });

    it("rechaza estudianteIndex negativo o no entero", () => {
        const negativo = payloadUnificadoSchema.safeParse(
            payloadBase({ identificadores: [{ estudianteIndex: -1, valor: "nick123" }] })
        );
        expect(negativo.success).toBe(false);
        const decimal = payloadUnificadoSchema.safeParse(
            payloadBase({ identificadores: [{ estudianteIndex: 0.5, valor: "nick123" }] })
        );
        expect(decimal.success).toBe(false);
    });

    it("rechaza un estudiante sin apellidos con el mensaje humano de SPEC-144", () => {
        const resultado = payloadUnificadoSchema.safeParse(
            payloadBase({ estudiantes: [{ nombre: "María" }] })
        );
        expect(resultado.success).toBe(false);
        if (!resultado.success) {
            expect(resultado.error.issues.some((i) => i.message === "Falta el apellido del estudiante")).toBe(true);
        }
    });

    it("rechaza más de 2 acudientes por estudiante", () => {
        const acudiente = { orden: 1, nombre: "Laura Díaz", relacion: "Madre" };
        const resultado = payloadUnificadoSchema.safeParse(
            payloadBase({
                estudiantes: [
                    { nombre: "María", apellidos: "Gómez", acudientes: [acudiente, { ...acudiente, orden: 2 }, { ...acudiente, orden: 2 }] },
                ],
            })
        );
        expect(resultado.success).toBe(false);
    });

    it("rechaza plataformaId que no sea cuid", () => {
        const resultado = payloadUnificadoSchema.safeParse(
            payloadBase({ identificadores: [{ estudianteIndex: 0, valor: "nick", plataformaId: "no-es-cuid" }] })
        );
        expect(resultado.success).toBe(false);
    });

    it("rechaza payload sin curso o sin nombre de curso", () => {
        expect(payloadUnificadoSchema.safeParse({ estudiantes: [], identificadores: [] }).success).toBe(false);
        expect(
            payloadUnificadoSchema.safeParse(payloadBase({ curso: { nombre: "X" } })).success
        ).toBe(false);
    });

    it("ignora claves desconocidas (el objeto no es strict) pero exige las mínimas", () => {
        const resultado = payloadUnificadoSchema.safeParse(payloadBase({ extra: "ignorado", curso2: CUID_2 }));
        expect(resultado.success).toBe(true);
        if (resultado.success) {
            expect("extra" in resultado.data).toBe(false);
        }
    });
});

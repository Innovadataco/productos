/**
 * SPEC-353 (A-69 · C6) — reglas de la frase "qué hacer hoy" del rector.
 * Una prueba por regla de prioridad + empates + colegio virgen + privacidad.
 */
import { describe, it, expect } from "vitest";
import { calcularQueHacerHoy, type DatosQueHacerHoy } from "./que-hacer-hoy";

const AHORA = new Date("2026-09-01T12:00:00.000Z");

function base(sobre: Partial<DatosQueHacerHoy> = {}): DatosQueHacerHoy {
    return {
        alertasSinAbrir: 0,
        ultimaAlertaSinAbrirEn: null,
        casosComite: { abiertos: 0, masViejoEn: null },
        identificadorCruzado: { identificadores: 0, estudiantesMax: 0 },
        ultimaSenal: null,
        ahora: AHORA,
        ...sobre,
    };
}

describe("calcularQueHacerHoy (SPEC-353)", () => {
    it("prioriza el identificador CRUZADO por encima de todo", () => {
        const r = calcularQueHacerHoy(
            base({
                identificadorCruzado: { identificadores: 1, estudiantesMax: 2 },
                alertasSinAbrir: 5,
                casosComite: { abiertos: 1, masViejoEn: new Date("2026-08-30T12:00:00Z") },
            }),
        );
        expect(r.tono).toBe("ambar");
        expect(r.detalle).toContain("misma cuenta");
        expect(r.detalle).toContain("dos estudiantes");
        expect(r.accionHref).toBe("/dashboard/colegio/alertas");
        // Tres frentes pendientes → el título los cuenta.
        expect(r.titulo).toBe("Tres cosas necesitan su atención hoy");
    });

    it("alertas sin abrir cuando no hay cruzado", () => {
        const r = calcularQueHacerHoy(base({ alertasSinAbrir: 2 }));
        expect(r.tono).toBe("ambar");
        expect(r.detalle).toContain("Dos avisos esperan su atención");
        expect(r.accionHref).toBe("/dashboard/colegio/alertas");
        expect(r.titulo).toBe("Algo necesita su atención hoy");
    });

    it("una sola alerta usa singular", () => {
        const r = calcularQueHacerHoy(base({ alertasSinAbrir: 1 }));
        expect(r.detalle).toContain("Un aviso espera su atención");
    });

    it("caso en comité con antigüedad cuando no hay alertas ni cruzado", () => {
        const r = calcularQueHacerHoy(
            base({ casosComite: { abiertos: 1, masViejoEn: new Date("2026-08-30T12:00:00Z") } }),
        );
        expect(r.tono).toBe("ambar");
        expect(r.detalle).toContain("El comité tiene un caso desde hace 2 días");
        expect(r.accionHref).toBe("/dashboard/colegio/comite");
    });

    it("calma con la última señal cuando no hay pendientes", () => {
        const r = calcularQueHacerHoy(base({ ultimaSenal: new Date("2026-08-28T12:00:00Z") }));
        expect(r.tono).toBe("calma");
        expect(r.titulo).toBe("Todo al día");
        expect(r.detalle).toContain("28 de agosto");
    });

    it("colegio virgen (sin señales nunca): calma sin fecha, jamás rota", () => {
        const r = calcularQueHacerHoy(base());
        expect(r.tono).toBe("calma");
        expect(r.detalle).toBe("No hay nada que espere por usted en este momento.");
    });

    it("dos frentes → título 'Dos cosas necesitan su atención hoy'", () => {
        const r = calcularQueHacerHoy(
            base({ alertasSinAbrir: 3, casosComite: { abiertos: 1, masViejoEn: null } }),
        );
        expect(r.titulo).toBe("Dos cosas necesitan su atención hoy");
    });

    it("privacidad (SC-005): ninguna frase contiene un valor de identificador", () => {
        const r = calcularQueHacerHoy(
            base({ identificadorCruzado: { identificadores: 2, estudiantesMax: 3 } }),
        );
        // La frase solo trae conteos en palabras; ningún nick/@/número.
        expect(r.detalle).not.toMatch(/@|\d{5,}/);
    });

    it("voz de usted, cero voseo", () => {
        for (const datos of [
            base({ alertasSinAbrir: 1 }),
            base({ identificadorCruzado: { identificadores: 1, estudiantesMax: 2 } }),
            base(),
        ]) {
            const r = calcularQueHacerHoy(datos);
            expect(`${r.titulo} ${r.detalle}`).not.toMatch(/tenés|podés|mirá|revisá|tú /i);
        }
    });
});

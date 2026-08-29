/**
 * SPEC-129 (C6): auditoría legible — frases naturales y detalle sin JSON crudo.
 */
import { describe, it, expect } from "vitest";
import { fraseAccionLegible, detalleLegible } from "./legible";

describe("fraseAccionLegible (SPEC-129 C6)", () => {
    it("traduce las acciones del colegio a lenguaje natural", () => {
        expect(fraseAccionLegible("COLEGIO_CURSO_CREADO")).toBe("Se creó un curso");
        expect(fraseAccionLegible("COLEGIO_CARGA_MASIVA")).toBe("Carga masiva de alumnos");
        expect(fraseAccionLegible("COLEGIO_ESTADISTICAS_PDF_DESCARGADO")).toBe("Se descargó el informe PDF");
    });

    it("una acción desconocida se humaniza (nunca el literal crudo)", () => {
        expect(fraseAccionLegible("OTRA_ACCION_RARA")).toBe("Otra accion rara");
    });
});

describe("detalleLegible (SPEC-129 C6, O-4)", () => {
    it("convierte JSON a pares etiqueta-valor (sin JSON crudo)", () => {
        const pares = detalleLegible('{"nombre":"6°A","grado":"SEXTO","activo":true,"creadoEn":null}');
        expect(pares).toEqual([
            { clave: "Nombre", valor: "6°A" },
            { clave: "Grado", valor: "SEXTO" },
            { clave: "Activo", valor: "Sí" },
            { clave: "Creado en", valor: "—" },
        ]);
    });

    it("formatea fechas ISO y no deja JSON sin parsear", () => {
        const pares = detalleLegible('{"fecha":"2026-08-01T14:00:00.000Z"}');
        expect(pares[0].clave).toBe("Fecha");
        expect(pares[0].valor).not.toContain("2026-08-01T14:00:00.000Z");
    });

    it("valor nulo → sin pares; texto plano → un par Detalle", () => {
        expect(detalleLegible(null)).toEqual([]);
        expect(detalleLegible("texto suelto")).toEqual([{ clave: "Detalle", valor: "texto suelto" }]);
    });
});

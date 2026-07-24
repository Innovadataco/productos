import { describe, it, expect } from "vitest";
import { esReporteAprobado } from "./reporte-aprobado";

describe("esReporteAprobado (spec 089-US3)", () => {
    it("CLASIFICADO con categoría de riesgo cuenta", () => {
        expect(esReporteAprobado({ estado: "CLASIFICADO", eliminado: false }, "EXTORSION")).toBe(true);
        expect(esReporteAprobado({ estado: "CORREGIDO", eliminado: false }, "CONTACTO_INSISTENTE")).toBe(true);
    });

    it("SPAM no cuenta aunque esté CLASIFICADO", () => {
        expect(esReporteAprobado({ estado: "CLASIFICADO", eliminado: false }, "SPAM")).toBe(false);
    });

    it("OTRO no cuenta (sin riesgo, sin spam)", () => {
        expect(esReporteAprobado({ estado: "CLASIFICADO", eliminado: false }, "OTRO")).toBe(false);
    });

    it("sin categoría no cuenta", () => {
        expect(esReporteAprobado({ estado: "CLASIFICADO", eliminado: false }, null)).toBe(false);
        expect(esReporteAprobado({ estado: "CLASIFICADO", eliminado: false })).toBe(false);
    });

    it("estados no aprobados no cuentan", () => {
        for (const estado of ["PENDIENTE", "PROCESANDO", "REVISION_MANUAL", "POSIBLE_SPAM", "DUPLICADO", "REQUIERE_ANONIMIZACION"]) {
            expect(esReporteAprobado({ estado, eliminado: false }, "EXTORSION"), estado).toBe(false);
        }
    });

    it("eliminado no cuenta", () => {
        expect(esReporteAprobado({ estado: "CLASIFICADO", eliminado: true }, "EXTORSION")).toBe(false);
    });
});

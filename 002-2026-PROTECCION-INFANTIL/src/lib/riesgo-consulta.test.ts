import { describe, it, expect } from "vitest";
import { calcularRiesgoConsulta, NivelRiesgoConsulta } from "./riesgo-consulta";

function buildReportes(cantidad: number, confianza: number, categoria = "SOLICITUD_MATERIAL") {
    return Array.from({ length: cantidad }, () => ({
        clasificacion: { categoria: categoria as any, confianza },
    }));
}

describe("calcularRiesgoConsulta", () => {
    it("con 0 reportes devuelve bajo y confianza 0", () => {
        const result = calcularRiesgoConsulta([]);
        expect(result.nivelRiesgo).toBe("BAJO");
        expect(result.score).toBe(0);
        expect(result.confianzaPromedio).toBe(0);
        expect(result.categoriaPrincipal).toBeNull();
    });

    it("con 1 reporte grave y alta confianza nunca da ALTO", () => {
        const result = calcularRiesgoConsulta(buildReportes(1, 0.95, "COMPARTIMIENTO_SEXUAL"));
        expect(result.nivelRiesgo).not.toBe("ALTO");
        expect(result.confianzaPromedio).toBe(0.95);
    });

    it("con 3 reportes graves y alta confianza da ALTO", () => {
        const result = calcularRiesgoConsulta(buildReportes(3, 0.9, "SOLICITUD_ENCUENTRO"));
        expect(result.nivelRiesgo).toBe("ALTO");
        expect(result.score).toBeGreaterThan(75);
    });

    it("con 3 reportes de baja gravedad da nivel conservador", () => {
        const result = calcularRiesgoConsulta(buildReportes(3, 0.6, "CONTACTO_INSISTENTE"));
        expect(result.nivelRiesgo).toBe("MEDIO");
    });

    it("respeta umbrales configurables", () => {
        const result = calcularRiesgoConsulta(buildReportes(5, 0.9, "COMPARTIMIENTO_SEXUAL"), {
            umbralMedio: 90,
            umbralAlto: 95,
            minReportesAlto: 2,
        });
        expect(result.nivelRiesgo).toBe("MEDIO");
    });

    it("sin clasificación IA, score es bajo por gravedad 0", () => {
        const result = calcularRiesgoConsulta([{ clasificacion: null }, { clasificacion: null }]);
        expect(result.nivelRiesgo).toBe("BAJO");
    });
});

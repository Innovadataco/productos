/**
 * SPEC-234 (002-PI-134): tests de la plantilla markdown.
 */
import { describe, it, expect } from "vitest";
import { renderizarMarkdown } from "./renderizar-markdown";

describe("renderizarMarkdown", () => {
    it("genera secciones esperadas sin texto original de reportes", () => {
        const resumen = renderizarMarkdown({
            numEventos: 3,
            categorias: [{ categoria: "CONTACTO_INSISTENTE", totalEventos: 2, confianzaPromedio: 0.8 }],
            patrones: [],
            senal: {
                identificadorReportado: "+573001234567",
                totalExpedientesActivos: 1,
                totalExpedientesCerrados: 0,
                totalExpedientesEscalados: 0,
                categoriasFrecuenciaJson: { CONTACTO_INSISTENTE: 2 },
                primeraAparicionEn: new Date(),
                ultimaAparicionEn: new Date(),
                paisesJson: { CO: 2 },
                ciudadesJson: { Bogotá: 2 },
                plataformasJson: { whatsapp: 2 },
                invalidado: false,
                actualizadoEn: new Date(),
            },
            score: 10,
            gravedad: "VERDE",
        });

        expect(resumen).toContain("# Informe consolidado");
        expect(resumen).toContain("## Alcance");
        expect(resumen).toContain("## Clasificaciones");
        expect(resumen).toContain("## Resumen");
        expect(resumen).toContain("## Patrones");
        expect(resumen).toContain("## Señal comunitaria");
        expect(resumen).toContain("## Nivel de gravedad");
        expect(resumen).not.toContain("Evento de prueba");
        expect(resumen).toContain("CONTACTO_INSISTENTE");
    });
});

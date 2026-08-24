import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IdentificadorAgregadoAnonimo } from "./IdentificadorAgregadoAnonimo";
import type { SenalComunitariaData } from "@/lib/expediente/compilacion/queries/senal-comunitaria";

function senalBase(): SenalComunitariaData {
    return {
        identificadorReportado: "@nick_ejemplo",
        totalExpedientesActivos: 2,
        totalExpedientesCerrados: 1,
        totalExpedientesEscalados: 0,
        categoriasFrecuenciaJson: { GROOMING: 3, SIN_CATEGORIA: 1 },
        primeraAparicionEn: new Date("2026-08-01T10:00:00Z"),
        ultimaAparicionEn: new Date("2026-08-20T10:00:00Z"),
        paisesJson: { Colombia: 4 },
        ciudadesJson: {},
        plataformasJson: { whatsapp: 3, telegram: 1 },
        invalidado: false,
        actualizadoEn: new Date("2026-08-21T10:00:00Z"),
    };
}

describe("IdentificadorAgregadoAnonimo (SPEC-233)", () => {
    it("muestra totales por estado y dimensiones con frecuencia", () => {
        render(<IdentificadorAgregadoAnonimo senal={senalBase()} />);

        expect(screen.getByText("Expedientes activos")).toBeDefined();
        expect(screen.getByText("2")).toBeDefined();
        expect(screen.getByText("GROOMING")).toBeDefined();
        expect(screen.getByText("whatsapp")).toBeDefined();
        expect(screen.getByText("Colombia")).toBeDefined();
    });

    it("muestra '—' por dimensión sin datos", () => {
        render(<IdentificadorAgregadoAnonimo senal={senalBase()} />);

        // ciudadesJson está vacío → su bloque muestra "—".
        expect(screen.getByText("Ciudades")).toBeDefined();
        expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
    });

    it("el agregado no expone identidades ni textos", () => {
        const { container } = render(<IdentificadorAgregadoAnonimo senal={senalBase()} />);

        const html = container.innerHTML;
        expect(html).not.toMatch(/padreUsuarioId/i);
        expect(html).not.toMatch(/[\w.-]+@[\w.-]+\.\w+/);
        expect(html).not.toMatch(/\+57\d{10}/);
    });
});

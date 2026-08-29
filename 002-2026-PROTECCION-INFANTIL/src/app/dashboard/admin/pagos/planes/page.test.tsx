/**
 * SPEC-260 + SPEC-254 (002-PI-157): smoke test de la pantalla Planes.
 * Verifica que PlanesAdminCRUD renderiza un plan sembrado y que el cuerpo
 * enviado a POST /api/admin/pagos/planes acepta precioBaseUSD: 0.
 */
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { pagosPlanCreateSchema } from "@/lib/schemas/pagos";
import { PlanesAdminCRUD } from "@/components/modules/PlanesAdminCRUD";

const planDePrueba = {
    id: "plan-smoke-001",
    nombre: "Plan Smoke Test",
    tipoTitular: "PADRE" as const,
    duracion: "MES_3" as const,
    anio: 2026,
    precioBaseCOP: 120000,
    esFreemium: false,
    usosMaximosPorCliente: null,
    activo: true,
    descripcion: null,
};

const paginacion = { page: 1, pageSize: 25, total: 1, totalPages: 1 };

describe("PlanesAdminCRUD — smoke (SPEC-260)", () => {
    beforeEach(() => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({ items: [planDePrueba], pagination: paginacion }),
            })
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("renderiza el nombre del plan después de la carga", async () => {
        render(<PlanesAdminCRUD />);
        const celda = await screen.findByText("Plan Smoke Test");
        expect(celda).toBeTruthy();
    });
});

describe("pagosPlanCreateSchema — contrato real PlanesAdminCRUD (SPEC-254)", () => {
    it("acepta el cuerpo exacto que arma guardar() con precioBaseUSD: 0", () => {
        // PlanesAdminCRUD.guardar() siempre envía precioBaseUSD: 0 cuando el usuario no lo rellena.
        // El freemium real siempre lleva usosMaximosPorCliente >= 1 (validación cruzada del esquema).
        const bodyReal = {
            nombre: "Plan smoke",
            precioBaseCOP: 0,
            precioBaseUSD: 0,
            duracion: "MES_3",
            tipoTitular: "PADRE",
            descripcion: undefined,
            activo: true,
            usosMaximosPorCliente: 1,
            esFreemium: true,
        };
        const resultado = pagosPlanCreateSchema.safeParse(bodyReal);
        expect(resultado.success, resultado.error?.message).toBe(true);
        if (resultado.success) {
            expect(resultado.data.precioBaseUSD).toBe(0);
        }
    });
});

/**
 * SPEC-218 (002-PI-118): tests unitarios de los widgets de acción del
 * dashboard dinero-vs-valor (sin BD).
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EstadoSuscripcion, TipoTitular } from "@prisma/client";
import { WidgetVencimientosSemana } from "./WidgetVencimientosSemana";
import { WidgetMoraLarga } from "./WidgetMoraLarga";
import { WidgetPadresPagantesColegiosCaidos } from "./WidgetPadresPagantesColegiosCaidos";

describe("WidgetVencimientosSemana", () => {
    const escribir = vi.fn().mockResolvedValue(undefined);

    beforeEach(() => {
        escribir.mockClear();
        Object.assign(navigator, { clipboard: { writeText: escribir } });
    });

    it("lista vencimientos con días restantes y copia los contactos", async () => {
        render(
            <WidgetVencimientosSemana
                data={{
                    total: 2,
                    items: [
                        {
                            suscripcionId: "s1",
                            nombre: "Colegio Andino",
                            rol: TipoTitular.COLEGIO,
                            email: null,
                            fechaFin: "2026-08-29",
                            diasRestantes: 5,
                        },
                        {
                            suscripcionId: "s2",
                            nombre: "Padre López",
                            rol: TipoTitular.PADRE,
                            email: "lopez@test.co",
                            fechaFin: "2026-08-25",
                            diasRestantes: 1,
                        },
                    ],
                }}
            />
        );
        expect(screen.getByText("Colegio Andino")).toBeTruthy();
        expect(screen.getByText("5 días")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: /Copiar contactos/ }));
        await waitFor(() => expect(escribir).toHaveBeenCalledWith("lopez@test.co"));
    });

    it("estado vacío y sin botón cuando no hay contactos", () => {
        const { rerender } = render(<WidgetVencimientosSemana data={{ total: 0, items: [] }} />);
        expect(screen.getByText(/No hay suscripciones por vencer/)).toBeTruthy();
        expect(screen.queryByRole("button")).toBeNull();

        rerender(
            <WidgetVencimientosSemana
                data={{
                    total: 1,
                    items: [
                        {
                            suscripcionId: "s1",
                            nombre: "Colegio Andino",
                            rol: TipoTitular.COLEGIO,
                            email: null,
                            fechaFin: "2026-08-29",
                            diasRestantes: 5,
                        },
                    ],
                }}
            />
        );
        expect(screen.queryByRole("button")).toBeNull();
    });
});

describe("WidgetMoraLarga", () => {
    it("muestra tarjetas con días de mora y acción de bono ad-hoc", () => {
        render(
            <WidgetMoraLarga
                data={{
                    total: 1,
                    items: [
                        {
                            suscripcionId: "s9",
                            nombre: "Padre López",
                            rol: TipoTitular.PADRE,
                            diasMora: 35,
                            estado: EstadoSuscripcion.SUSPENDIDA,
                        },
                    ],
                }}
            />
        );
        expect(screen.getByText("Padre López")).toBeTruthy();
        expect(screen.getByText("35 días")).toBeTruthy();
        expect(screen.getByRole("link", { name: "Crear bono ad-hoc" }).getAttribute("href")).toBe(
            "/dashboard/admin/pagos/bonos"
        );
    });

    it("estado vacío", () => {
        render(<WidgetMoraLarga data={{ total: 0, items: [] }} />);
        expect(screen.getByText(/No hay suscripciones con más de 30 días de mora/)).toBeTruthy();
    });
});

describe("WidgetPadresPagantesColegiosCaidos", () => {
    it("muestra la card resaltada con el contacto del rector", () => {
        render(
            <WidgetPadresPagantesColegiosCaidos
                data={{
                    total: 1,
                    items: [
                        {
                            padreId: "u1",
                            padreNombre: "Ana R.",
                            colegioId: "c1",
                            colegioNombre: "Colegio Beta",
                            colegioEstado: EstadoSuscripcion.SUSPENDIDA,
                            rectorNombre: "Rector Beta",
                            rectorEmail: "rector@beta.edu",
                        },
                    ],
                }}
            />
        );
        expect(screen.getByText("Ana R.")).toBeTruthy();
        expect(screen.getByText(/Colegio Beta/)).toBeTruthy();
        expect(screen.getByRole("link", { name: "rector@beta.edu" }).getAttribute("href")).toBe(
            "mailto:rector@beta.edu"
        );
    });

    it("estado vacío", () => {
        render(<WidgetPadresPagantesColegiosCaidos data={{ total: 0, items: [] }} />);
        expect(screen.getByText(/No hay padres pagantes de colegios sin renovar/)).toBeTruthy();
    });
});

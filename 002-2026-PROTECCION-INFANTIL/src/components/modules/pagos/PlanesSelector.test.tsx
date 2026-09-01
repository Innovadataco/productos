/**
 * SPEC-355 — PlanesSelector: la tarjeta de prueba gratis para el COLEGIO.
 * Recorrido del CEO en prod: el plan freemium COLEGIO existía activo en BD pero
 * la tarjeta no se pintaba (gate `rol === "PARENT"`) y el rector no podía
 * avanzar sin pagar. Además el copy interno era tuteo fijo.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlanesSelector } from "./PlanesSelector";
import type { PlanSelectorDTO } from "@/lib/pagos/planes-selector.types";

const PLAN_PAGADO: PlanSelectorDTO = {
    id: "p-anual",
    nombre: "Colegio Anual",
    descripcion: null,
    duracion: "MES_12",
    precioBaseCOP: 1_000_000,
    precioBaseUSD: 0,
    descuentoAnualPct: 10,
    esFreemium: false,
    activo: true,
};

const PLAN_FREEMIUM: PlanSelectorDTO = {
    id: "p-free",
    nombre: "Colegio · Prueba gratis 30 días",
    descripcion: "Pruebe la plataforma con su colegio sin costo.",
    duracion: "MES_1",
    precioBaseCOP: 0,
    precioBaseUSD: 0,
    descuentoAnualPct: null,
    esFreemium: true,
    activo: true,
};

function renderSelector(opts: { planes: PlanSelectorDTO[]; rol: "PARENT" | "SCHOOL_ADMIN"; conFreemium?: boolean }) {
    return render(
        <PlanesSelector
            planes={opts.planes}
            usuario={{ id: "u1", rol: opts.rol, nombre: "X", email: "x@x.co" }}
            color={opts.rol === "PARENT" ? "cielo" : "pino"}
            onSeleccionar={vi.fn()}
            onFreemium={opts.conFreemium === false ? undefined : vi.fn()}
        />,
    );
}

describe("PlanesSelector (SPEC-355)", () => {
    it("COLEGIO: pinta la tarjeta freemium cuando el plan freemium existe, con su nombre de BD", () => {
        renderSelector({ planes: [PLAN_FREEMIUM, PLAN_PAGADO], rol: "SCHOOL_ADMIN" });
        const tarjeta = screen.getByTestId("plan-freemium");
        expect(tarjeta.textContent).toContain("Colegio · Prueba gratis 30 días");
        expect(tarjeta.textContent).toContain("Pruebe la plataforma con su colegio sin costo.");
        expect(screen.getByRole("button", { name: "Activar prueba gratis" })).toBeTruthy();
        // El plan pagado sigue presente.
        expect(screen.getByText("Colegio Anual")).toBeTruthy();
    });

    it("COLEGIO: sin plan freemium en BD no hay tarjeta (no se inventa una oferta)", () => {
        renderSelector({ planes: [PLAN_PAGADO], rol: "SCHOOL_ADMIN" });
        expect(screen.queryByTestId("plan-freemium")).toBeNull();
    });

    it("COLEGIO: sin acción de freemium (dashboard de suscripción) no hay tarjeta", () => {
        renderSelector({ planes: [PLAN_FREEMIUM, PLAN_PAGADO], rol: "SCHOOL_ADMIN", conFreemium: false });
        expect(screen.queryByTestId("plan-freemium")).toBeNull();
    });

    it("COLEGIO: voz de usted — cero tuteo en la pantalla", () => {
        const { container } = renderSelector({ planes: [PLAN_FREEMIUM, PLAN_PAGADO], rol: "SCHOOL_ADMIN" });
        expect(screen.getByText("Elija su plan")).toBeTruthy();
        expect(screen.getByText("Seleccione el plan institucional para su colegio.")).toBeTruthy();
        const texto = container.textContent ?? "";
        for (const tuteo of ["Elige tu", "Selecciona", "tu colegio", "Explora la"]) {
            expect(texto, `sin "${tuteo}"`).not.toContain(tuteo);
        }
    });

    it("PADRE: conserva su tarjeta histórica y su tuteo", () => {
        renderSelector({ planes: [PLAN_PAGADO], rol: "PARENT" });
        expect(screen.getByTestId("plan-freemium")).toBeTruthy();
        expect(screen.getByText("Elige tu plan")).toBeTruthy();
        expect(screen.getByText(/Explora la plataforma sin costo durante 30 días/)).toBeTruthy();
    });
});

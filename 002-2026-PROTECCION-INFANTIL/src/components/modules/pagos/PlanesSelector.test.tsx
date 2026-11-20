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

function renderSelector(opts: {
    planes: PlanSelectorDTO[];
    rol: "PARENT" | "SCHOOL_ADMIN";
    conFreemium?: boolean;
    nombreColegio?: string;
}) {
    return render(
        <PlanesSelector
            planes={opts.planes}
            usuario={{ id: "u1", rol: opts.rol, nombre: "X", email: "x@x.co" }}
            color={opts.rol === "PARENT" ? "cielo" : "pino"}
            onSeleccionar={vi.fn()}
            onFreemium={opts.conFreemium === false ? undefined : vi.fn()}
            nombreColegio={opts.nombreColegio}
        />,
    );
}

describe("PlanesSelector (SPEC-355)", () => {
    // SPEC-957 (B.1) · CANDADO: la tarjeta freemium del colegio se titula con el
    // NOMBRE REAL del colegio, no con el nombre genérico del plan sembrado. Control
    // positivo: si el título volviera a `planFreemium.nombre`, mostraría «Colegio ·
    // Prueba gratis 30 días» y no «Colegio 40 …» → este test se pone rojo.
    it("COLEGIO: la tarjeta freemium se titula con el NOMBRE del colegio (no el del plan sembrado)", () => {
        renderSelector({ planes: [PLAN_FREEMIUM, PLAN_PAGADO], rol: "SCHOOL_ADMIN", nombreColegio: "Colegio 40" });
        const tarjeta = screen.getByTestId("plan-freemium");
        // Título compuesto con el nombre real + la duración.
        expect(tarjeta.textContent).toContain("Colegio 40 · Prueba gratis 30 días");
        // El nombre genérico del plan sembrado NO titula la tarjeta.
        const titulo = tarjeta.querySelector("h3");
        expect(titulo?.textContent).toBe("Colegio 40 · Prueba gratis 30 días");
        expect(titulo?.textContent).not.toBe(PLAN_FREEMIUM.nombre);
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

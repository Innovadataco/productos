/**
 * SPEC-744 · CANDADO — BarraInferior + HojaMas: la navegación MÓVIL única de los 4 roles.
 *
 *  - La partición sale de `navMovilParaRol` (fuente única, por rol/módulos); la barra pinta
 *    EXACTO los `principales` (≤4) + «Más», con rótulo corto (`labelCorto ?? label`).
 *  - NUNCA scroll horizontal (el anti-patrón de PadreNavMovil que reemplaza): pestañas fijas.
 *  - «Más» abre `HojaMas` con el `resto` — NADA queda inalcanzable (control positivo: para el
 *    padre, «Mis citas» sólo se alcanza por «Más»).
 *  - Roles que caben en ≤4 (profesional) NO llevan «Más».
 *  - Activo por ruta en cielo + aria-current (barra-indicador arriba, no sólo color · WCAG 1.4.1).
 *  - SPEC-502: cero color crudo.
 *
 * Usa el resolver REAL (no mock): prueba que la barra refleja la fuente gateada de verdad.
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

let mockPathname = "/x";
const authRef: { value: unknown } = { value: { user: null } };
vi.mock("next/navigation", () => ({ usePathname: () => mockPathname }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => authRef.value }));

import { BarraInferior } from "./BarraInferior";
import type { RolLateral } from "./NavLateral";

afterEach(() => {
    cleanup();
    authRef.value = { user: null };
    mockPathname = "/x";
});

function montar(rol: RolLateral, opts: { modulos?: string[]; pathname?: string; profesional?: unknown } = {}) {
    mockPathname = opts.pathname ?? "/x";
    authRef.value = { user: { rol }, isLoading: false };
    // SPEC-802: el estado del profesional llega por PROP (resuelto en el servidor), no por el cliente.
    return render(
        <BarraInferior
            rol={rol}
            modulosPermitidos={opts.modulos ?? []}
            profesionalInicial={opts.profesional as { habilitado: boolean } | null | undefined}
        />,
    );
}

describe("SPEC-744 · BarraInferior: pestañas fijas de la fuente única (sin scroll horizontal)", () => {
    it("padre: 4 principales con rótulo CORTO + «Más», y la barra NO scrollea horizontal", () => {
        const { container } = montar("PARENT", { pathname: "/dashboard/padre" });
        expect(screen.getByText("Inicio")).toBeTruthy();
        expect(screen.getByText("Protejo")).toBeTruthy(); // labelCorto de «A quién protejo»
        expect(screen.getByText("Psicólogos")).toBeTruthy(); // labelCorto de «Encontrar psicólogo»
        expect(screen.getByRole("button", { name: /Más/ })).toBeTruthy();
        // El anti-patrón que reemplaza (PadreNavMovil tenía overflow-x-auto): prohibido.
        expect(container.querySelector("nav")?.className ?? "").not.toContain("overflow-x");
    });

    it("profesional: caben las 4, SIN «Más» (resto vacío)", () => {
        montar("PROFESIONAL", { profesional: { habilitado: true }, pathname: "/dashboard/profesional" });
        expect(screen.getByText("Inicio")).toBeTruthy();
        expect(screen.getByText("Casos")).toBeTruthy();
        expect(screen.queryByRole("button", { name: /Más/ })).toBeNull();
    });
});

describe("SPEC-744 · HojaMas: «Más» alcanza el resto (nada inalcanzable)", () => {
    it("CONTROL POSITIVO · «Mis citas» (resto del padre) NO está en la barra pero SÍ tras «Más»", () => {
        montar("PARENT", { pathname: "/dashboard/padre" });
        // Antes de abrir: «Mis citas» no es una pestaña (vive en el resto).
        expect(screen.queryByText("Mis citas")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: /Más/ }));
        // La hoja trae el resto (grupos incluidos): «Mis citas» alcanzable.
        expect(screen.getByText("Mis citas")).toBeTruthy();
    });
});

describe("SPEC-744 · BarraInferior: activo por ruta y tokens", () => {
    it("activo: Inicio en el landing padre va aria-current + cielo", () => {
        montar("PARENT", { pathname: "/dashboard/padre" });
        const inicio = screen.getByText("Inicio").closest("a");
        expect(inicio?.getAttribute("aria-current")).toBe("page");
        expect(inicio?.className).toContain("text-cielo-700");
    });

    it("SPEC-502: cero color crudo (slate/sky/amber… -NNN)", () => {
        const { container } = montar("PARENT", { pathname: "/dashboard/padre" });
        const crudo =
            /\b(?:bg|text|border|ring|shadow|from|to|via|divide|outline)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;
        expect(crudo.test(container.innerHTML)).toBe(false);
    });
});

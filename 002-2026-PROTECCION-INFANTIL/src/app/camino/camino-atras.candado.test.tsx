/**
 * SPEC-556 (I-338) · CANDADO: el camino del padre tiene «Atrás» en los pasos 2, 3 y 4,
 * y lleva al paso ANTERIOR (para corregir un dato). El dato ya cargado se conserva
 * porque Atrás solo NAVEGA (router.push) — no borra ni resetea; cada pantalla recarga
 * lo que se guardó al avanzar. Muere si el botón desaparece o si apunta mal.
 *
 * No toca vitest.unit.includes.ts: cae en el shard de integración (jsdom disponible ahí).
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const push = vi.fn();
let pathnameActual = "/camino/hijos";
vi.mock("next/navigation", () => ({
    usePathname: () => pathnameActual,
    useRouter: () => ({ push }),
}));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ logout: vi.fn() }) }));

import CaminoLayout from "./layout";

function renderEn(path: string) {
    pathnameActual = path;
    return render(
        <CaminoLayout>
            <div>contenido del paso</div>
        </CaminoLayout>
    );
}

describe("SPEC-556 · «Atrás» en el camino del padre (pasos 2, 3 y 4)", () => {
    beforeEach(() => push.mockClear());

    it("paso 3 (hijos) → Atrás lleva al paso 2 (datos), sin borrar (solo navega)", () => {
        renderEn("/camino/hijos");
        fireEvent.click(screen.getByRole("button", { name: /Atrás/ }));
        expect(push).toHaveBeenCalledWith("/camino/datos");
        expect(push).toHaveBeenCalledTimes(1);
    });

    it("paso 4 (plan) → Atrás lleva al paso 3 (hijos)", () => {
        renderEn("/camino/plan");
        fireEvent.click(screen.getByRole("button", { name: /Atrás/ }));
        expect(push).toHaveBeenCalledWith("/camino/hijos");
    });

    it("paso 2 (datos) → Atrás lleva al paso 1 (consentimiento)", () => {
        renderEn("/camino/datos");
        fireEvent.click(screen.getByRole("button", { name: /Atrás/ }));
        expect(push).toHaveBeenCalledWith("/consentimiento");
    });
});

/**
 * SPEC-756 · CANDADO de la PUERTA de consentimiento en la PÁGINA.
 *
 * La página `/consentimiento` servía el formulario a CUALQUIER rol con versión
 * no vigente (solo miraba `versionEstaActual`), aunque el redirect del emisor de
 * sesión ya exime a los no-titulares: un interno que entraba a mano podía
 * fabricar la firma que el auditor (SPEC-755) marca como inválida. La puerta
 * deriva de la MISMA fuente única `esTitularDelDato` (no una condición a mano).
 *
 * Control positivo en LAS DOS direcciones:
 *  - rol NO titular (OPERADOR/COMITE_VALIDACION) → redirige a su tablero, NO sirve
 *    el formulario;
 *  - rol titular (PARENT/SCHOOL_ADMIN) sin firma vigente → SÍ sirve el formulario.
 * Muere por mutación: quitar el guard deja servir el form a un no-titular → el
 * primer test falla (no redirige / renderiza el modal).
 *
 * Mockea auth + service + redirect (sin BD). Usa el esTitularDelDato REAL: el
 * candado vigila que la página lea la fuente única, no una lista propia.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const verifyTokenMock = vi.fn();
const versionEstaActualMock = vi.fn();
const documentoPorRolMock = vi.fn();
const obtenerDocumentoVigenteMock = vi.fn();
const redirectMock = vi.fn((path: string) => {
    // Emula next/navigation.redirect: corta la ejecución lanzando (como en Next).
    throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock("next/navigation", () => ({ redirect: (p: string) => redirectMock(p) }));
vi.mock("next/headers", () => ({
    cookies: async () => ({ get: (name: string) => (name === "token" ? { name, value: "tok" } : undefined) }),
}));
vi.mock("@/lib/auth", () => ({ verifyToken: (...a: unknown[]) => verifyTokenMock(...a) }));
vi.mock("@/lib/dal/services/consentimiento", () => ({
    ConsentimientoService: class {
        versionEstaActual = (...a: unknown[]) => versionEstaActualMock(...a);
        documentoPorRol = (...a: unknown[]) => documentoPorRolMock(...a);
        obtenerDocumentoVigente = (...a: unknown[]) => obtenerDocumentoVigenteMock(...a);
    },
}));
vi.mock("@/components/modules/ModalConsentimiento", () => ({
    ModalConsentimiento: (props: { rol: string; documentoTipo: string }) => (
        <div data-testid="modal-consent" data-rol={props.rol} data-doc={props.documentoTipo} />
    ),
}));

import ConsentimientoPage from "./page";

// Los destinos por rol están en page.tsx (DASHBOARD_POR_ROL). El candado los
// fija: si alguien cambia el destino de un no-titular, se entera.
const DASHBOARD = {
    OPERADOR: "/dashboard/admin/bandeja",
    COMITE_VALIDACION: "/dashboard/admin",
    PARENT: "/dashboard/padre",
    SCHOOL_ADMIN: "/dashboard/colegio",
} as const;

describe("SPEC-756 · puerta de titular en /consentimiento (página)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        versionEstaActualMock.mockResolvedValue(false); // nadie tiene firma vigente
        obtenerDocumentoVigenteMock.mockResolvedValue("# contenido");
    });

    it("no-titular OPERADOR → redirige a su tablero y NO sirve el formulario", async () => {
        verifyTokenMock.mockResolvedValue({ sub: "op-1", rol: "OPERADOR" });
        await expect(ConsentimientoPage()).rejects.toThrow(`NEXT_REDIRECT:${DASHBOARD.OPERADOR}`);
        expect(redirectMock).toHaveBeenCalledWith(DASHBOARD.OPERADOR);
        // la puerta corta ANTES de la lógica de consentimiento
        expect(versionEstaActualMock).not.toHaveBeenCalled();
        expect(documentoPorRolMock).not.toHaveBeenCalled();
    });

    it("no-titular COMITE_VALIDACION → redirige a su tablero (segundo rol interno)", async () => {
        verifyTokenMock.mockResolvedValue({ sub: "cv-1", rol: "COMITE_VALIDACION" });
        await expect(ConsentimientoPage()).rejects.toThrow(`NEXT_REDIRECT:${DASHBOARD.COMITE_VALIDACION}`);
    });

    it("titular PARENT sin firma vigente → SÍ sirve el formulario (POLITICA_DATOS)", async () => {
        verifyTokenMock.mockResolvedValue({ sub: "p-1", rol: "PARENT" });
        documentoPorRolMock.mockReturnValue("POLITICA_DATOS");
        const jsx = await ConsentimientoPage();
        render(jsx);
        const modal = screen.getByTestId("modal-consent");
        expect(modal).toBeTruthy();
        expect(modal.getAttribute("data-rol")).toBe("PARENT");
        expect(modal.getAttribute("data-doc")).toBe("POLITICA_DATOS");
    });

    it("titular SCHOOL_ADMIN sin firma vigente → SÍ sirve el formulario (CONVENIO_INSTITUCIONAL)", async () => {
        verifyTokenMock.mockResolvedValue({ sub: "sa-1", rol: "SCHOOL_ADMIN" });
        documentoPorRolMock.mockReturnValue("CONVENIO_INSTITUCIONAL");
        const jsx = await ConsentimientoPage();
        render(jsx);
        const modal = screen.getByTestId("modal-consent");
        expect(modal.getAttribute("data-doc")).toBe("CONVENIO_INSTITUCIONAL");
    });

    it("titular que YA aceptó (versión vigente) → redirige a su tablero (no rompe el camino existente)", async () => {
        verifyTokenMock.mockResolvedValue({ sub: "p-2", rol: "PARENT" });
        versionEstaActualMock.mockResolvedValue(true);
        await expect(ConsentimientoPage()).rejects.toThrow(`NEXT_REDIRECT:${DASHBOARD.PARENT}`);
    });
});

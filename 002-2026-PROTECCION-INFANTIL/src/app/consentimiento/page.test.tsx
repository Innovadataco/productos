/**
 * SPEC-241 (002-PI-144): test de integración de la página /consentimiento.
 * Verifica que el Server Component redirige sin sesión, redirige cuando el
 * consentimiento ya está actualizado y renderiza el modal cuando corresponde.
 */
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import ConsentimientoPage from "./page";
import { ModalConsentimiento } from "@/components/modules/ModalConsentimiento";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { crearParametrosConsentimiento } from "@/lib/consentimiento-test-utils";
import { redirect } from "next/navigation";

let mockToken: string | undefined;
let mockPayload: { sub: string; rol: string } | null = null;

vi.mock("next/headers", () => ({
    cookies: vi.fn(async () => ({
        get: (name: string) =>
            (name === "token" || name === "__Host-token") && mockToken
                ? { name, value: mockToken }
                : undefined,
    })),
}));

vi.mock("next/navigation", () => ({
    redirect: vi.fn((url: string) => {
        throw new Error(`NEXT_REDIRECT ${url}`);
    }),
}));

vi.mock(import("@/lib/auth"), async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/auth")>();
    return {
        ...actual,
        verifyToken: vi.fn(async () => mockPayload),
    };
});

vi.mock("@/components/modules/ModalConsentimiento", () => ({
    ModalConsentimiento: vi.fn(
        (props: {
            rol: string;
            documentoTipo: string;
            documentoContenido: string;
            redirectUrl: string;
        }) => (
            <div
                data-testid="modal-consentimiento"
                data-rol={props.rol}
                data-documento-tipo={props.documentoTipo}
                data-redirect-url={props.redirectUrl}
            >
                {props.documentoContenido.slice(0, 50)}
            </div>
        )
    ),
}));

type ModalProps = {
    rol: string;
    documentoTipo: string;
    documentoContenido: string;
    redirectUrl: string;
    // SPEC-339: rótulo del Paso 1 cuando el padre recorre el camino.
    indicadorPaso?: string;
};

async function invocarPagina(): Promise<React.ReactNode> {
    return ConsentimientoPage();
}

describe("ConsentimientoPage (SPEC-241)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosConsentimiento();
        mockToken = undefined;
        mockPayload = null;
        vi.clearAllMocks();
    });

    it("redirige a /login cuando no hay token", async () => {
        mockToken = undefined;
        await expect(invocarPagina()).rejects.toThrow("NEXT_REDIRECT /login");
    });

    it("redirige a /login cuando el token no es válido", async () => {
        mockToken = "token-invalido";
        mockPayload = null;
        await expect(invocarPagina()).rejects.toThrow("NEXT_REDIRECT /login");
    });

    it("redirige al dashboard del padre cuando ya aceptó la versión vigente", async () => {
        const padre = await crearUsuario("PARENT");
        await prisma.usuario.update({
            where: { id: padre.id },
            data: {
                consentimientoVersion: "v0.4",
                consentimientoAceptadoEn: new Date(),
                consentimientoDocumentoHash: "hash",
                consentimientoIP: "127.0.0.1",
            },
        });

        mockToken = "token-padre";
        mockPayload = { sub: padre.id, rol: "PARENT" };

        // SPEC-339: el padre ya no va a una pantalla fija — aterriza en el panel
        // y el guardián del camino lo lleva a su paso pendiente.
        await expect(invocarPagina()).rejects.toThrow(
            "NEXT_REDIRECT /dashboard/padre"
        );
    });

    it("renderiza ModalConsentimiento con la política de datos para PARENT", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = "token-padre";
        mockPayload = { sub: padre.id, rol: "PARENT" };

        const elemento = (await invocarPagina()) as React.ReactElement<ModalProps>;

        expect(elemento.type).toBe(ModalConsentimiento);
        expect(elemento.props.rol).toBe("PARENT");
        expect(elemento.props.documentoTipo).toBe("POLITICA_DATOS");
        expect(elemento.props.redirectUrl).toBe("/dashboard/padre"); // SPEC-339
        // SPEC-339 (brief §2.2): para el padre esta pantalla es el Paso 1 del camino.
        expect(elemento.props.indicadorPaso).toBe("Paso 1 de 4 · Permiso");
        expect(elemento.props.documentoContenido.length).toBeGreaterThan(0);
    });

    it("renderiza ModalConsentimiento con el convenio institucional para SCHOOL_ADMIN", async () => {
        const admin = await crearUsuario("SCHOOL_ADMIN");
        mockToken = "token-admin";
        mockPayload = { sub: admin.id, rol: "SCHOOL_ADMIN" };

        const elemento = (await invocarPagina()) as React.ReactElement<ModalProps>;

        expect(elemento.type).toBe(ModalConsentimiento);
        expect(elemento.props.rol).toBe("SCHOOL_ADMIN");
        expect(elemento.props.documentoTipo).toBe("CONVENIO_INSTITUCIONAL");
        expect(elemento.props.redirectUrl).toBe("/dashboard/colegio");
        expect(elemento.props.documentoContenido.length).toBeGreaterThan(0);
    });
});

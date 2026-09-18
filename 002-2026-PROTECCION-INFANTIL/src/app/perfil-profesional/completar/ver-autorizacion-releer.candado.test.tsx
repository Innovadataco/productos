/**
 * CANDADO · SPEC-705 · El enlace de la autorización en la ficha lleva el modo RELEER cuando ya
 * está aceptada. Sin `?releer=1`, la página de aceptación rebota al que ya aceptó → «Ver la
 * autorización» no mostraba nada. Prueba la CONDUCTA renderizada (el href del enlace real), no la
 * fuente. CONTROL POSITIVO: sin aceptar, el enlace va SIN releer (a leer y aceptar).
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
    default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
// Subcomponentes irrelevantes al enlace: se apagan para que el render sea liviano y no busque red.
vi.mock("@/components/modules/profesional/DocumentosRequisitos", () => ({ DocumentosRequisitos: () => null }));
vi.mock("@/components/ui/CiudadSearchSelect", () => ({ CiudadSearchSelect: () => null }));

import CompletarPerfilProfesionalPage from "./page";

type AutorizacionResp = {
    version: string | null;
    aceptadaVigente: boolean;
    aceptadaEn: string | null;
    versionAceptada: string | null;
};

function stubFetch(autorizacion: AutorizacionResp) {
    global.fetch = vi.fn(async (url: RequestInfo | URL) => {
        const u = String(url);
        const body = u.includes("/api/profesional/perfil")
            ? { perfil: null, autorizacion }
            : u.includes("/api/paises")
                ? { paises: [] }
                : u.includes("/api/profesional/catalogos")
                    ? { catalogos: { profesion: [], areas: [], rangoEtario: [] } }
                    : {};
        return { ok: true, json: async () => body } as Response;
    }) as typeof fetch;
}

describe("SPEC-705 · el enlace de la ficha lleva releer cuando ya aceptó", () => {
    afterEach(() => vi.restoreAllMocks());

    it("aceptada → «Ver la autorización» apunta con ?releer=1", async () => {
        stubFetch({ version: "v0.1", aceptadaVigente: true, aceptadaEn: new Date().toISOString(), versionAceptada: "v0.1" });
        render(<CompletarPerfilProfesionalPage />);
        const link = await screen.findByText("Ver la autorización");
        expect(link.getAttribute("href")).toBe("/perfil-profesional/autorizacion?releer=1");
    });

    it("CONTROL · sin aceptar → «Leer y aceptar la autorización» va SIN releer", async () => {
        stubFetch({ version: "v0.1", aceptadaVigente: false, aceptadaEn: null, versionAceptada: null });
        render(<CompletarPerfilProfesionalPage />);
        const link = await screen.findByText("Leer y aceptar la autorización");
        expect(link.getAttribute("href")).toBe("/perfil-profesional/autorizacion");
    });
});

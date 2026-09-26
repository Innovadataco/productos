/**
 * CANDADO de RENDER · SPEC-706 (PR A + PR B) + SPEC-740 (asistente) · El paso 1 (Ficha) del
 * asistente de registro, sobre el DOM que el profesional ve.
 *
 * Se renderiza la ficha REAL y se afirma la CONDUCTA (no la fuente):
 *   · DOS acciones —«Guardar borrador» + «Siguiente: documentos»— (SPEC-740: el paso 1 GUARDA y
 *     AVANZA; el «enviar a revisión» ya NO vive acá, es el paso 3 terminal).
 *   · «Siguiente: documentos» NO se bloquea por completitud (guarda el borrador y avanza); la ficha
 *     da una GUÍA honesta de lo que faltará para enviar al final (incl. «Edad que atiende» —el campo
 *     del bug medido— y «Aceptar la autorización»). CONTROL POSITIVO: completa + aceptada → sin guía.
 *   · Al guardar borrador, el mensaje dice EN QUÉ QUEDÓ («Guardado como borrador…»), no «Cambios guardados».
 *   · Áreas = CHIPS que togglean (aria-pressed) con contador (PR B), no casillas.
 *   · En EN_REVISION la ficha es de SOLO LECTURA: sin botones de acción, fieldset deshabilitado, y el
 *     ENCABEZADO de estado (reubicado de «Mi estado», PR B) muestra el aviso de entrega de Diseño.
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

// SPEC-740: el paso 1 usa `useRouter` para «Siguiente» (guardar y avanzar a Documentos).
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("@/components/modules/profesional/DocumentosRequisitos", () => ({ DocumentosRequisitos: () => null }));
vi.mock("@/components/ui/CiudadSearchSelect", () => ({ CiudadSearchSelect: () => null }));

import CompletarPerfilProfesionalPage from "./page";

type Perfil = Record<string, unknown>;
type Vista = { estadoPerfil: string; puedeReenviar: boolean; observaciones: unknown[] } | null;
type Autorizacion = { version: string | null; aceptadaVigente: boolean; aceptadaEn: string | null; versionAceptada: string | null };

const CATALOGOS = {
    profesion: [{ clave: "psicologo", nombre: "Psicólogo" }],
    areas: [{ grupo: "Emocional", items: [{ clave: "ansiedad", nombre: "Ansiedad" }, { clave: "duelo", nombre: "Duelo" }] }],
    rangoEtario: [{ clave: "6-11", nombre: "6 a 11" }],
};

const COMPLETO: Perfil = {
    id: "p1",
    nombreVisible: "Dra. Ramírez",
    profesion: "psicologo",
    areasAtencion: ["ansiedad"],
    rangoEtario: ["6-11"],
    ciudad: { id: "c1", nombre: "Bogotá", paisId: "co" },
    atiendeVirtual: true,
    atiendePresencial: false,
    aniosExperiencia: 5,
    presentacion: "Acompaño a familias con niñez y adolescencia.",
    emiteFactura: false,
    estado: "BORRADOR",
};

const ACEPTADA: Autorizacion = { version: "v0.1", aceptadaVigente: true, aceptadaEn: new Date().toISOString(), versionAceptada: "v0.1" };
const SIN_ACEPTAR: Autorizacion = { version: "v0.1", aceptadaVigente: false, aceptadaEn: null, versionAceptada: null };
const vistaDe = (estado: string): Vista => ({ estadoPerfil: estado, puedeReenviar: false, observaciones: [] });

/** GET devuelve getPerfil/vista/habilitado; PUT devuelve putPerfil (para probar el guardado). */
function stub(opts: { getPerfil: Perfil | null; putPerfil?: Perfil; vista: Vista; habilitado?: boolean; autorizacion: Autorizacion }) {
    global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        const u = String(url);
        const method = (init?.method ?? "GET").toUpperCase();
        if (u.includes("/api/profesional/perfil")) {
            const perfil = method === "PUT" ? (opts.putPerfil ?? opts.getPerfil) : opts.getPerfil;
            return { ok: true, json: async () => ({ perfil, autorizacion: opts.autorizacion, vista: opts.vista, habilitado: opts.habilitado ?? false }) } as Response;
        }
        if (u.includes("/api/paises")) return { ok: true, json: async () => ({ paises: [{ id: "co", nombre: "Colombia" }] }) } as Response;
        if (u.includes("/api/profesional/catalogos")) return { ok: true, json: async () => ({ catalogos: CATALOGOS }) } as Response;
        return { ok: true, json: async () => ({}) } as Response;
    }) as typeof fetch;
}

const enviarBtn = () => screen.queryByRole("button", { name: "Guardar y enviar a revisión" });
const siguienteBtn = () => screen.queryByRole("button", { name: "Siguiente: documentos" });

describe("SPEC-706 + SPEC-740 · el paso 1 (Ficha) del asistente (render real)", () => {
    afterEach(() => {
        cleanup();
        pushMock.mockReset();
        vi.restoreAllMocks();
    });

    it("editable: encabezado de estado arriba + «Guardar borrador» y «Siguiente: documentos» (NO enviar acá)", async () => {
        stub({ getPerfil: { ...COMPLETO, areasAtencion: [] }, vista: vistaDe("BORRADOR"), autorizacion: SIN_ACEPTAR });
        render(<CompletarPerfilProfesionalPage />);
        // El encabezado de estado (reubicado de «Mi estado») está arriba.
        expect(await screen.findByText("Verificación de su perfil")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeTruthy();
        expect(siguienteBtn()).toBeTruthy();
        // SPEC-740: el envío a revisión es el paso 3 (terminal) — NO vive en la ficha.
        expect(enviarBtn()).toBeNull();
        expect(screen.queryByText(/queda a su disposición para editar/)).toBeNull();
    });

    it("CANDADO · «Siguiente» NO se bloquea por completitud; la ficha GUÍA lo que faltará para enviar", async () => {
        stub({ getPerfil: { ...COMPLETO, rangoEtario: [] }, vista: vistaDe("BORRADOR"), autorizacion: SIN_ACEPTAR });
        render(<CompletarPerfilProfesionalPage />);
        const siguiente = await screen.findByRole("button", { name: "Siguiente: documentos" });
        // Avanzar guarda el borrador (no exige todo): el «Siguiente» queda ACTIVO.
        expect((siguiente as HTMLButtonElement).disabled).toBe(false);
        const aviso = screen.getByText(/Para enviar a revisión al final, aún falta:/);
        expect(aviso.textContent).toContain("Edad que atiende");
        expect(aviso.textContent).toContain("Aceptar la autorización");
    });

    it("CONTROL POSITIVO · completa + aceptada → sin guía de faltantes; «Siguiente» activo", async () => {
        stub({ getPerfil: COMPLETO, vista: vistaDe("BORRADOR"), autorizacion: ACEPTADA });
        render(<CompletarPerfilProfesionalPage />);
        const siguiente = await screen.findByRole("button", { name: "Siguiente: documentos" });
        expect((siguiente as HTMLButtonElement).disabled).toBe(false);
        expect(screen.queryByText(/Para enviar a revisión al final, aún falta:/)).toBeNull();
    });

    it("CANDADO · «Siguiente» GUARDA (PUT) y avanza a Documentos — el bug-killer de SPEC-740", async () => {
        stub({ getPerfil: COMPLETO, putPerfil: COMPLETO, vista: vistaDe("BORRADOR"), autorizacion: ACEPTADA });
        render(<CompletarPerfilProfesionalPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Siguiente: documentos" }));
        await waitFor(() => {
            const puts = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
                ([u, init]) => String(u).includes("/api/profesional/perfil") && (init as RequestInit | undefined)?.method === "PUT",
            );
            expect(puts.length, "no hubo PUT (borrador) antes de avanzar").toBeGreaterThan(0);
            expect(pushMock).toHaveBeenCalledWith("/perfil-profesional/documentos");
        });
    });

    it("CANDADO · guardar borrador dice EN QUÉ QUEDÓ (no solo «Cambios guardados»)", async () => {
        stub({ getPerfil: COMPLETO, putPerfil: COMPLETO, vista: vistaDe("BORRADOR"), autorizacion: ACEPTADA });
        render(<CompletarPerfilProfesionalPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Guardar borrador" }));
        expect(await screen.findByText(/Guardado como borrador\. Todavía no lo enviamos a revisión\./)).toBeTruthy();
        expect(screen.queryByText("Cambios guardados.")).toBeNull();
    });

    it("PR B · áreas = CHIPS que togglean (aria-pressed) con contador, no casillas", async () => {
        stub({ getPerfil: { ...COMPLETO, areasAtencion: [] }, vista: vistaDe("BORRADOR"), autorizacion: SIN_ACEPTAR });
        render(<CompletarPerfilProfesionalPage />);
        const chip = await screen.findByRole("button", { name: "Ansiedad", pressed: false });
        expect(screen.getByText("0 áreas elegidas")).toBeTruthy();
        fireEvent.click(chip);
        expect(screen.getByRole("button", { name: "Ansiedad", pressed: true })).toBeTruthy();
        expect(screen.getByText("1 áreas elegidas")).toBeTruthy();
    });

    it("CANDADO · EN_REVISION: SOLO LECTURA — sin botones de acción, fieldset deshabilitado, encabezado con aviso de entrega", async () => {
        stub({ getPerfil: { ...COMPLETO, estado: "EN_REVISION" }, vista: vistaDe("EN_REVISION"), autorizacion: ACEPTADA });
        const { container } = render(<CompletarPerfilProfesionalPage />);
        // El encabezado (reubicado de «Mi estado») muestra el aviso de entrega de Diseño.
        expect(await screen.findByText(/Su solicitud quedó en revisión\./)).toBeTruthy();
        expect(screen.getByText(/El resultado le llegará por correo/)).toBeTruthy();
        // No es su turno: sin acciones (ni «Guardar borrador», ni «Siguiente», ni enviar).
        expect(enviarBtn()).toBeNull();
        expect(siguienteBtn()).toBeNull();
        expect(screen.queryByRole("button", { name: "Guardar borrador" })).toBeNull();
        const fieldset = container.querySelector("form fieldset") as HTMLFieldSetElement | null;
        expect(fieldset, "no se encontró el fieldset del formulario").not.toBeNull();
        expect(fieldset!.disabled).toBe(true);
    });
});

/**
 * CANDADO de RENDER · SPEC-706 (PR A + PR B) · El cierre de la ficha, sobre el DOM que el profesional ve.
 *
 * Se renderiza la ficha REAL y se afirma la CONDUCTA (no la fuente):
 *   · DOS acciones explícitas —«Guardar borrador» + «Guardar y enviar a revisión»—, sin modal.
 *   · «Guardar y enviar a revisión» queda INERTE hasta que no falte nada, y la ficha NOMBRA lo que
 *     falta (incl. «Edad que atiende» —el campo del bug medido— y «Aceptar la autorización»).
 *     CONTROL POSITIVO: completa + aceptada → habilita.
 *   · Al guardar borrador, el mensaje dice EN QUÉ QUEDÓ («Guardado como borrador…»), no «Cambios guardados».
 *   · Áreas = CHIPS que togglean (aria-pressed) con contador (PR B), no casillas.
 *   · En EN_REVISION la ficha es de SOLO LECTURA: sin botones de acción, fieldset deshabilitado, y el
 *     ENCABEZADO de estado (reubicado de «Mi estado», PR B) muestra el aviso de entrega de Diseño.
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

vi.mock("next/link", () => ({
    default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
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

describe("SPEC-706 · el cierre de la ficha (render real)", () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it("editable: encabezado de estado arriba, DOS botones explícitos, sin modal", async () => {
        stub({ getPerfil: { ...COMPLETO, areasAtencion: [] }, vista: vistaDe("BORRADOR"), autorizacion: SIN_ACEPTAR });
        render(<CompletarPerfilProfesionalPage />);
        // El encabezado de estado (reubicado de «Mi estado») está arriba.
        expect(await screen.findByText("Verificación de su perfil")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeTruthy();
        expect(enviarBtn()).toBeTruthy();
        expect(screen.queryByText(/queda a su disposición para editar/)).toBeNull();
    });

    it("CANDADO · «Guardar y enviar a revisión» INERTE hasta completar, y la ficha NOMBRA lo que falta", async () => {
        stub({ getPerfil: { ...COMPLETO, rangoEtario: [] }, vista: vistaDe("BORRADOR"), autorizacion: SIN_ACEPTAR });
        render(<CompletarPerfilProfesionalPage />);
        const enviar = await screen.findByRole("button", { name: "Guardar y enviar a revisión" });
        expect((enviar as HTMLButtonElement).disabled, "enviar inerte con un obligatorio vacío").toBe(true);
        const aviso = screen.getByText(/Para enviar a revisión, falta:/);
        expect(aviso.textContent).toContain("Edad que atiende");
        expect(aviso.textContent).toContain("Aceptar la autorización");
    });

    it("CONTROL POSITIVO · completa + aceptada → «Guardar y enviar a revisión» habilitado", async () => {
        stub({ getPerfil: COMPLETO, vista: vistaDe("BORRADOR"), autorizacion: ACEPTADA });
        render(<CompletarPerfilProfesionalPage />);
        const enviar = await screen.findByRole("button", { name: "Guardar y enviar a revisión" });
        expect((enviar as HTMLButtonElement).disabled).toBe(false);
        expect(screen.queryByText(/Para enviar a revisión, falta:/)).toBeNull();
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
        // No es su turno: sin acciones.
        expect(enviarBtn()).toBeNull();
        expect(screen.queryByRole("button", { name: "Guardar borrador" })).toBeNull();
        const fieldset = container.querySelector("form fieldset") as HTMLFieldSetElement | null;
        expect(fieldset, "no se encontró el fieldset del formulario").not.toBeNull();
        expect(fieldset!.disabled).toBe(true);
    });
});

/**
 * CANDADO de RENDER · SPEC-706 PR A · La ficha ya no deja al profesional «congelado» (Jelkin).
 *
 * Se renderiza la ficha REAL y se afirma la CONDUCTA (no la fuente):
 *   · DOS acciones explícitas —«Guardar borrador» + «Guardar y enviar a revisión»—, sin modal.
 *   · «Guardar y enviar a revisión» queda INERTE hasta que no falte nada, y la ficha NOMBRA lo que
 *     falta (incl. «Edad que atiende» —el campo del bug medido— y «Aceptar la autorización»).
 *     CONTROL POSITIVO: completa + aceptada → habilita.
 *   · Al guardar borrador, el mensaje dice EN QUÉ QUEDÓ («Guardado como borrador…»), NUNCA solo
 *     «Cambios guardados» (que dejaba a Jelkin sin saber si envió).
 *   · Al enviar y quedar EN_REVISION, la ficha muestra el aviso de entrega de Diseño y queda de
 *     SOLO LECTURA (fieldset deshabilitado, sin botones); el servidor igual bloquea el PUT.
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
type Autorizacion = { version: string | null; aceptadaVigente: boolean; aceptadaEn: string | null; versionAceptada: string | null };

const CATALOGOS = {
    profesion: [{ clave: "psicologo", nombre: "Psicólogo" }],
    areas: [{ grupo: "Emocional", items: [{ clave: "ansiedad", nombre: "Ansiedad" }] }],
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

/** GET devuelve `getPerfil`; PUT devuelve `putPerfil` (para probar el resultado del guardado). */
function stub(opts: { getPerfil: Perfil | null; putPerfil?: Perfil; autorizacion: Autorizacion }) {
    global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        const u = String(url);
        const method = (init?.method ?? "GET").toUpperCase();
        if (u.includes("/api/profesional/perfil")) {
            const perfil = method === "PUT" ? (opts.putPerfil ?? opts.getPerfil) : opts.getPerfil;
            return { ok: true, json: async () => ({ perfil, autorizacion: opts.autorizacion }) } as Response;
        }
        if (u.includes("/api/paises")) return { ok: true, json: async () => ({ paises: [{ id: "co", nombre: "Colombia" }] }) } as Response;
        if (u.includes("/api/profesional/catalogos")) return { ok: true, json: async () => ({ catalogos: CATALOGOS }) } as Response;
        return { ok: true, json: async () => ({}) } as Response;
    }) as typeof fetch;
}

const enviarBtn = () => screen.queryByRole("button", { name: "Guardar y enviar a revisión" });

describe("SPEC-706 PR A · el cierre de la ficha (render real)", () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it("editable: DOS botones explícitos (borrador + enviar), sin modal", async () => {
        stub({ getPerfil: { ...COMPLETO, areasAtencion: [] }, autorizacion: SIN_ACEPTAR });
        render(<CompletarPerfilProfesionalPage />);
        expect(await screen.findByRole("button", { name: "Guardar borrador" })).toBeTruthy();
        expect(enviarBtn()).toBeTruthy();
        expect(screen.queryByText(/queda a su disposición para editar/)).toBeNull();
    });

    it("CANDADO · «Guardar y enviar a revisión» INERTE hasta completar, y la ficha NOMBRA lo que falta", async () => {
        stub({ getPerfil: { ...COMPLETO, rangoEtario: [] }, autorizacion: SIN_ACEPTAR });
        render(<CompletarPerfilProfesionalPage />);
        const enviar = await screen.findByRole("button", { name: "Guardar y enviar a revisión" });
        expect((enviar as HTMLButtonElement).disabled, "enviar inerte con un obligatorio vacío").toBe(true);
        const aviso = screen.getByText(/Para enviar a revisión, falta:/);
        expect(aviso.textContent).toContain("Edad que atiende");
        expect(aviso.textContent).toContain("Aceptar la autorización");
    });

    it("CONTROL POSITIVO · completa + aceptada → «Guardar y enviar a revisión» habilitado", async () => {
        stub({ getPerfil: COMPLETO, autorizacion: ACEPTADA });
        render(<CompletarPerfilProfesionalPage />);
        const enviar = await screen.findByRole("button", { name: "Guardar y enviar a revisión" });
        expect((enviar as HTMLButtonElement).disabled).toBe(false);
        expect(screen.queryByText(/Para enviar a revisión, falta:/)).toBeNull();
    });

    it("CANDADO · guardar borrador dice EN QUÉ QUEDÓ (no solo «Cambios guardados»)", async () => {
        stub({ getPerfil: COMPLETO, putPerfil: COMPLETO, autorizacion: ACEPTADA });
        render(<CompletarPerfilProfesionalPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Guardar borrador" }));
        expect(await screen.findByText(/Guardado como borrador\. Todavía no lo enviamos a revisión\./)).toBeTruthy();
        expect(screen.queryByText("Cambios guardados.")).toBeNull();
    });

    it("CANDADO · al enviar → EN_REVISION: aviso de entrega (Diseño) + SOLO LECTURA (sin botones)", async () => {
        stub({ getPerfil: COMPLETO, putPerfil: { ...COMPLETO, estado: "EN_REVISION" }, autorizacion: ACEPTADA });
        render(<CompletarPerfilProfesionalPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Guardar y enviar a revisión" }));
        // El aviso de entrega de Diseño (Gestión e69b591) aparece y el formulario queda de solo lectura.
        expect(await screen.findByText(/Su solicitud quedó en revisión\./)).toBeTruthy();
        expect(screen.getByText(/El resultado le llegará por correo/)).toBeTruthy();
        await waitFor(() => expect(enviarBtn()).toBeNull());
        expect(screen.queryByRole("button", { name: "Guardar borrador" })).toBeNull();
    });
});

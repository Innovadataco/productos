/**
 * CANDADO de RENDER · SPEC-706 · El cierre de la ficha, sobre el DOM que el profesional ve.
 *
 * Se renderiza la ficha REAL y se afirma la CONDUCTA (no la fuente):
 *   · DOS acciones explícitas —«Guardar borrador» + «Guardar y enviar a revisión»—, no un modal.
 *   · «Guardar y enviar a revisión» queda INERTE hasta que no falte nada (como el «Acepto»), y la
 *     ficha NOMBRA lo que falta. Es el bug medido por Jelkin: envió con «Edad que atiende» vacío y
 *     el perfil quedó en BORRADOR SIN decir nada. CONTROL POSITIVO: completa + aceptada → habilita.
 *   · Áreas = CHIPS que togglean (aria-pressed), con contador — no casillas planas.
 *   · En EN_REVISION la ficha es de SOLO LECTURA: fieldset deshabilitado y SIN botones de acción; el
 *     ENCABEZADO de estado (reubicado de «Mi estado») explica por qué.
 *   · No sobrevive la copy que se contradecía con el bloqueo («queda a su disposición para editar»).
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("next/link", () => ({
    default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
// Subcomponentes con red/estado propio: se apagan para que el render sea liviano y no busque red.
vi.mock("@/components/modules/profesional/DocumentosRequisitos", () => ({ DocumentosRequisitos: () => null }));
vi.mock("@/components/ui/CiudadSearchSelect", () => ({ CiudadSearchSelect: () => null }));

import CompletarPerfilProfesionalPage from "./page";

type Perfil = Record<string, unknown> | null;
type Vista = { estadoPerfil: string; puedeReenviar: boolean; observaciones: unknown[] } | null;
type Autorizacion = { version: string | null; aceptadaVigente: boolean; aceptadaEn: string | null; versionAceptada: string | null };

const CATALOGOS = {
    profesion: [{ clave: "psicologo", nombre: "Psicólogo" }],
    areas: [{ grupo: "Emocional", items: [{ clave: "ansiedad", nombre: "Ansiedad" }, { clave: "duelo", nombre: "Duelo" }] }],
    rangoEtario: [{ clave: "6-11", nombre: "6 a 11" }],
};

const PERFIL_COMPLETO = {
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

function stub(opts: { perfil?: Perfil; vista?: Vista; habilitado?: boolean; autorizacion?: Autorizacion }) {
    const autorizacion = opts.autorizacion ?? { version: "v0.1", aceptadaVigente: false, aceptadaEn: null, versionAceptada: null };
    global.fetch = vi.fn(async (url: RequestInfo | URL) => {
        const u = String(url);
        const body = u.includes("/api/profesional/perfil")
            ? { perfil: opts.perfil ?? null, autorizacion, vista: opts.vista ?? null, habilitado: opts.habilitado ?? false }
            : u.includes("/api/paises")
                ? { paises: [{ id: "co", nombre: "Colombia" }] }
                : u.includes("/api/profesional/catalogos")
                    ? { catalogos: CATALOGOS }
                    : {};
        return { ok: true, json: async () => body } as Response;
    }) as typeof fetch;
}

const enviarBtn = () => screen.queryByRole("button", { name: "Guardar y enviar a revisión" });

describe("SPEC-706 · el cierre de la ficha (render real)", () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it("editable: DOS botones explícitos (borrador + enviar), sin modal ni copy contradictoria", async () => {
        stub({ perfil: { ...PERFIL_COMPLETO, areasAtencion: [] }, vista: { estadoPerfil: "BORRADOR", puedeReenviar: false, observaciones: [] } });
        render(<CompletarPerfilProfesionalPage />);
        expect(await screen.findByRole("button", { name: "Guardar borrador" })).toBeTruthy();
        expect(enviarBtn()).toBeTruthy();
        // El modal retirado decía que la ficha «queda a su disposición para editar» — contradecía el
        // bloqueo en revisión. No puede reaparecer.
        expect(screen.queryByText(/queda a su disposición para editar/)).toBeNull();
    });

    it("CANDADO · «Guardar y enviar a revisión» INERTE hasta completar, y la ficha NOMBRA lo que falta", async () => {
        // Ficha completa salvo «Edad que atiende» (el campo del bug medido) y sin aceptar.
        stub({
            perfil: { ...PERFIL_COMPLETO, rangoEtario: [] },
            autorizacion: { version: "v0.1", aceptadaVigente: false, aceptadaEn: null, versionAceptada: null },
            vista: { estadoPerfil: "BORRADOR", puedeReenviar: false, observaciones: [] },
        });
        render(<CompletarPerfilProfesionalPage />);
        const enviar = await screen.findByRole("button", { name: "Guardar y enviar a revisión" });
        expect((enviar as HTMLButtonElement).disabled, "enviar debe estar inerte con un obligatorio vacío").toBe(true);
        // Nombra el campo faltante (Edad que atiende) y el paso de aceptación.
        const aviso = screen.getByText(/Para enviar a revisión, falta:/);
        expect(aviso.textContent).toContain("Edad que atiende");
        expect(aviso.textContent).toContain("Aceptar la autorización");
    });

    it("CONTROL POSITIVO · completa + autorización aceptada → «Guardar y enviar a revisión» habilitado", async () => {
        stub({
            perfil: PERFIL_COMPLETO,
            autorizacion: { version: "v0.1", aceptadaVigente: true, aceptadaEn: new Date().toISOString(), versionAceptada: "v0.1" },
            vista: { estadoPerfil: "BORRADOR", puedeReenviar: false, observaciones: [] },
        });
        render(<CompletarPerfilProfesionalPage />);
        const enviar = await screen.findByRole("button", { name: "Guardar y enviar a revisión" });
        expect((enviar as HTMLButtonElement).disabled, "completa+aceptada debe habilitar el envío").toBe(false);
        expect(screen.queryByText(/Para enviar a revisión, falta:/)).toBeNull();
    });

    it("áreas = CHIPS que togglean (aria-pressed) con contador, no casillas planas", async () => {
        stub({ perfil: { ...PERFIL_COMPLETO, areasAtencion: [] }, vista: { estadoPerfil: "BORRADOR", puedeReenviar: false, observaciones: [] } });
        render(<CompletarPerfilProfesionalPage />);
        const chip = await screen.findByRole("button", { name: "Ansiedad", pressed: false });
        expect(screen.getByText("0 áreas elegidas")).toBeTruthy();
        fireEvent.click(chip);
        // El mismo chip queda presionado y el contador sube: es selección múltiple con estado.
        expect(screen.getByRole("button", { name: "Ansiedad", pressed: true })).toBeTruthy();
        expect(screen.getByText("1 áreas elegidas")).toBeTruthy();
    });

    it("CANDADO · EN_REVISION: SOLO LECTURA — sin botones de acción, fieldset deshabilitado, con encabezado", async () => {
        stub({
            perfil: { ...PERFIL_COMPLETO, estado: "EN_REVISION" },
            vista: { estadoPerfil: "EN_REVISION", puedeReenviar: false, observaciones: [] },
        });
        const { container } = render(<CompletarPerfilProfesionalPage />);
        // El encabezado de estado (reubicado de «Mi estado») explica el bloqueo.
        expect(await screen.findByText("Verificación de su perfil")).toBeTruthy();
        // Ni «Guardar borrador» ni «Guardar y enviar a revisión»: no es su turno.
        expect(enviarBtn()).toBeNull();
        expect(screen.queryByRole("button", { name: "Guardar borrador" })).toBeNull();
        // El formulario está deshabilitado en el servidor Y en pantalla (fieldset disabled).
        const fieldset = container.querySelector("form fieldset") as HTMLFieldSetElement | null;
        expect(fieldset, "no se encontró el fieldset del formulario").not.toBeNull();
        expect(fieldset!.disabled).toBe(true);
    });
});

/**
 * CANDADO · SPEC-709 (FORMA-MI-PERFIL §1) · «Sus datos» se editan EN SITIO, por bloque.
 *
 * Jelkin: «Tu presentación… esto debe quedar en mi perfil» — hoy el habilitado que
 * quiere cambiar su presentación termina en la FICHA (la pantalla del portero).
 * Conductas que no se pueden fingir:
 *  1. «Muere el botón global»: no hay enlace a la ficha (`/perfil-profesional/completar`)
 *     para editar; cada bloque tiene su propio «Editar».
 *  2. La PRESENTACIÓN se edita sin salir de «Mi perfil»: «Editar» abre el textarea y
 *     «Guardar» hace un PUT PARCIAL con SOLO ese campo.
 *  3. Per-block de verdad: al guardar profesión se manda la CLAVE del catálogo (para que
 *     el servidor valide el catálogo cerrado — SPEC-685), y SOLO ese campo.
 *  4. Guardas de cliente: presentación < 20 no se puede guardar; modalidad en blanco
 *     (ambas false) tampoco.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import type { PerfilProfesionalPropioDto } from "@/lib/profesional/dto";
import type { VistaProfesionalVerificacion } from "@/lib/profesionales/verificador/vista-profesional";

vi.mock("@/components/modules/profesional/DocumentosRequisitos", () => ({
    DocumentosRequisitos: () => <div data-testid="docs" />,
}));
vi.mock("@/components/modules/verificacion/EstadoVerificacionProfesionalClient", () => ({
    EstadoVerificacionProfesionalClient: () => <div data-testid="estado" />,
}));

import { MiPerfilProfesionalClient } from "./MiPerfilProfesionalClient";

const PERFIL: PerfilProfesionalPropioDto = {
    id: "p1",
    nombreVisible: "Dra. Ramírez",
    fotoUrl: null,
    tituloProfesional: "Psicólogo/a",
    especialidades: ["Ansiedad"],
    ciudad: { id: "c1", nombre: "Bogotá", paisId: "co" },
    atiendeVirtual: true,
    atiendePresencial: false,
    aniosExperiencia: 8,
    presentacion: "Acompaño a las familias con cariño y experiencia.",
    tarifaConsultaCOP: 120_000,
    duracionMinutos: 50,
    emiteFactura: false,
    estado: "ACTIVO",
    autorizacionSubida: true,
    profesion: "psicologo",
    areasAtencion: ["ansiedad"],
    rangoEtario: ["6-11"],
};
const CATALOGOS = {
    profesion: [{ clave: "psicologo", nombre: "Psicólogo/a" }, { clave: "psiquiatra", nombre: "Médico psiquiatra" }],
    areas: [{ grupo: "Emocional", items: [{ clave: "ansiedad", nombre: "Ansiedad" }, { clave: "duelo", nombre: "Duelo" }] }],
    rangoEtario: [{ clave: "0-5", nombre: "Primera infancia (0–5)" }, { clave: "6-11", nombre: "Niñez (6–11)" }],
};
const VISTA = { estadoPerfil: "ACTIVO", puedeReenviar: false, observaciones: [] } as unknown as VistaProfesionalVerificacion;

function montar() {
    return render(
        <MiPerfilProfesionalClient perfil={PERFIL} catalogos={CATALOGOS} aviso={{ precioEstandar: 80_000, pct: 15 }} vista={VISTA} />,
    );
}
/** El bloque «Sus datos» de la fila cuya etiqueta se da (para acotar el «Editar»/«Guardar»). */
function bloque(etiqueta: string): HTMLElement {
    return screen.getByText(etiqueta).closest("div")!.parentElement as HTMLElement;
}

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

const SRC = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/modules/profesional/MiPerfilProfesionalClient.tsx"),
    "utf-8",
);

describe("SPEC-709 · «Sus datos» editable por bloque en «Mi perfil»", () => {
    it("«muere el botón global»: no enlaza a la ficha para editar; cada bloque tiene su «Editar»", () => {
        expect(SRC).not.toContain("/perfil-profesional/completar");
        expect(SRC).not.toContain("Editar mis datos");
        montar();
        // Varios «Editar» (uno por bloque), no uno global.
        expect(screen.getAllByRole("button", { name: "Editar" }).length).toBeGreaterThanOrEqual(6);
    });

    it("la PRESENTACIÓN se edita en sitio y guarda con un PUT PARCIAL de SOLO ese campo", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ perfil: {} }), { status: 200 }));
        montar();
        // Abre el bloque de presentación.
        fireEvent.click(within(bloque("Presentación")).getByRole("button", { name: "Editar" }));
        const textarea = screen.getByPlaceholderText(/Cuénteles a las familias/);
        fireEvent.change(textarea, { target: { value: "Nueva presentación con más de veinte caracteres, de verdad." } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [url, init] = fetchSpy.mock.calls[0]!;
        expect(url).toBe("/api/profesional/perfil");
        expect((init as RequestInit).method).toBe("PUT");
        const body = JSON.parse((init as RequestInit).body as string);
        // PARCIAL: SOLO la presentación viaja (no todo el perfil).
        expect(Object.keys(body)).toEqual(["presentacion"]);
        expect(body.presentacion).toMatch(/más de veinte caracteres/);
        await screen.findByText("Cambio guardado.");
    });

    it("al guardar la profesión se manda la CLAVE del catálogo (el servidor valida SPEC-685), y solo ese campo", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ perfil: {} }), { status: 200 }));
        montar();
        fireEvent.click(within(bloque("Profesión")).getByRole("button", { name: "Editar" }));
        fireEvent.change(screen.getByLabelText("Profesión"), { target: { value: "psiquiatra" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string);
        expect(body).toEqual({ profesion: "psiquiatra" }); // la clave, no la etiqueta; y solo eso
        await screen.findByText("Cambio guardado.");
    });

    it("guarda de cliente: presentación < 20 no se puede guardar", () => {
        montar();
        fireEvent.click(within(bloque("Presentación")).getByRole("button", { name: "Editar" }));
        fireEvent.change(screen.getByPlaceholderText(/Cuénteles a las familias/), { target: { value: "corto" } });
        expect(screen.getByRole("button", { name: "Guardar" })).toHaveProperty("disabled", true);
    });

    it("guarda de cliente: modalidad en blanco (ambas false) no se puede guardar", () => {
        montar();
        fireEvent.click(within(bloque("Modalidad")).getByRole("button", { name: "Editar" }));
        // El perfil arranca con virtual=true; al desmarcarla quedan ambas false.
        fireEvent.click(screen.getByLabelText(/Atiendo virtual/));
        expect(screen.getByRole("button", { name: "Guardar" })).toHaveProperty("disabled", true);
    });
});

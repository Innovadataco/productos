/**
 * CANDADO · SPEC-685 (PR2-bis · FORMA-MI-PERFIL §2-bis) · «Mi perfil» del habilitado.
 *
 * Conductas que no se pueden fingir:
 *  1. El aviso de la tarifa muestra los valores VIGENTES leídos en vivo (precio
 *     estándar de la 1ª cita + % de servicio). Si un parámetro falta (null), la
 *     frase va SIN número — NUNCA una cifra inventada. (Render real, no regex.)
 *  2. El estado de verificación va AL FINAL, después de los documentos (orden de
 *     Diseño / Jelkin).
 *  3. La tarifa SE MUDÓ: ya no está en la ficha (`completar`), vive acá.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import type { PerfilProfesionalPropioDto } from "@/lib/profesional/dto";
import type { VistaProfesionalVerificacion } from "@/lib/profesionales/verificador/vista-profesional";

// Aislamos el componente propio: los hijos se prueban en sus propios candados.
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
    presentacion: "Acompaño familias.",
    tarifaConsultaCOP: 120_000,
    duracionMinutos: 50,
    emiteFactura: false,
    estado: "ACTIVO",
    autorizacionSubida: true,
    profesion: "psicologo",
    areasAtencion: ["ansiedad"],
    rangoEtario: ["6-11"],
};
const RANGO = [{ clave: "6-11", nombre: "Niñez (6–11)" }];
const VISTA = { estadoPerfil: "ACTIVO", puedeReenviar: false, observaciones: [] } as unknown as VistaProfesionalVerificacion;

describe("SPEC-685 · «Mi perfil» · aviso de la tarifa (frase única, sin valores en vivo)", () => {
    it("el aviso es UNA frase, sin precio estándar ni % (decisión de Jelkin)", () => {
        const { container } = render(
            <MiPerfilProfesionalClient
                perfil={PERFIL}
                rangoCatalogo={RANGO}
                aviso={{ precioEstandar: 80_000, pct: 15 }}
                vista={VISTA}
            />,
        );
        // La frase verbatim que dejó el CEO.
        expect(screen.getByText("El valor que fija aquí es lo que usted recibe desde la segunda cita con cada familia.")).toBeTruthy();
        // Lo que se quitó: el marco «Cómo se cobra», el precio estándar y el %.
        expect(container.textContent).not.toContain("Cómo se cobra");
        expect(container.textContent).not.toContain("80.000");
        expect(container.textContent).not.toContain("15%");
    });

    it("tarifa por fijar (null): muestra el estado §2-ter, en positivo, no «$0»", () => {
        render(
            <MiPerfilProfesionalClient
                perfil={{ ...PERFIL, tarifaConsultaCOP: null }}
                rangoCatalogo={RANGO}
                aviso={{ precioEstandar: 80_000, pct: 15 }}
                vista={VISTA}
            />,
        );
        expect(screen.getByText(/Su tarifa está sin fijar/)).toBeTruthy();
        expect(screen.getByText(/Fije su tarifa/)).toBeTruthy();
    });

    it("con la tarifa vacía (0), Guardar NO manda 0 al servidor: pide «Escriba su tarifa»", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
        render(
            <MiPerfilProfesionalClient
                perfil={{ ...PERFIL, tarifaConsultaCOP: null }}
                rangoCatalogo={RANGO}
                aviso={{ precioEstandar: 80_000, pct: 15 }}
                vista={VISTA}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: /Guardar tarifa/ }));
        expect(await screen.findByText(/Escriba su tarifa/)).toBeTruthy();
        expect(fetchSpy).not.toHaveBeenCalled(); // el 0 NUNCA sale al servidor
        fetchSpy.mockRestore();
    });

    it("con tarifa fijada: NO aparece el estado «por fijar»", () => {
        render(
            <MiPerfilProfesionalClient
                perfil={{ ...PERFIL, tarifaConsultaCOP: 120_000 }}
                rangoCatalogo={RANGO}
                aviso={{ precioEstandar: 80_000, pct: 15 }}
                vista={VISTA}
            />,
        );
        expect(screen.queryByText(/Su tarifa está sin fijar/)).toBeNull();
    });

    it("estado «por fijar» sin el parámetro: la frase va SIN número, nunca inventada", () => {
        // El único valor EN VIVO que queda es el precio estándar de la nota «por
        // fijar» (§2-ter). Si falta el parámetro, la nota va sin número.
        const { container } = render(
            <MiPerfilProfesionalClient
                perfil={{ ...PERFIL, tarifaConsultaCOP: null }}
                rangoCatalogo={RANGO}
                aviso={{ precioEstandar: null, pct: null }}
                vista={VISTA}
            />,
        );
        expect(screen.getByText(/Su tarifa está sin fijar/)).toBeTruthy();
        expect(/hoy\s*[\d.]+\s*COP/.test(container.textContent ?? "")).toBe(false);
    });
});

describe("SPEC-685 · «Mi perfil» · orden y mudanza de la tarifa", () => {
    const src = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/modules/profesional/MiPerfilProfesionalClient.tsx"),
        "utf-8",
    );

    it("el estado de verificación va DESPUÉS de los documentos", () => {
        const iDocs = src.indexOf("Sus documentos");
        const iEstado = src.indexOf("EstadoVerificacionProfesionalClient", src.indexOf("return ("));
        expect(iDocs).toBeGreaterThan(0);
        expect(iEstado).toBeGreaterThan(iDocs);
    });

    it("la tarifa se mudó: ya no está en la ficha de completar", () => {
        const ficha = fs.readFileSync(
            path.resolve(process.cwd(), "src/app/perfil-profesional/completar/page.tsx"),
            "utf-8",
        );
        expect(ficha).not.toContain("Tarifa por consulta");
        expect(ficha).not.toContain("tarifaConsultaCOP");
    });
});

describe("SPEC-685 · FORMA §2-ter c · lo que ve la familia: «por definir», nunca «$0»", () => {
    const perfilPadre = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/modules/padre/profesionales/ProfesionalPerfil.tsx"),
        "utf-8",
    );
    const panelPadre = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/modules/padre/profesionales/SolicitarCitaPanel.tsx"),
        "utf-8",
    );

    it("ProfesionalPerfil dice «por definir» y formatea la tarifa SOLO si es > 0 (no «$0»)", () => {
        expect(perfilPadre).toContain("por definir");
        // SPEC-685 (Diseño): gatea por «> 0», no por «!== null» — un 0 también es «por definir».
        expect(/tarifaConsultaCOP !== null && p\.tarifaConsultaCOP > 0/.test(perfilPadre)).toBe(true);
    });

    it("SolicitarCitaPanel también dice «por definir» y gatea por > 0", () => {
        expect(panelPadre).toContain("por definir");
        expect(/tarifaProfesionalCOP !== null && tarifaProfesionalCOP > 0/.test(panelPadre)).toBe(true);
    });
});

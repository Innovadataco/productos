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
import { render, screen } from "@testing-library/react";
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

describe("SPEC-685 · «Mi perfil» · aviso de la tarifa con valores en vivo", () => {
    it("con parámetros presentes: muestra el precio estándar y el % vigentes", () => {
        render(
            <MiPerfilProfesionalClient
                perfil={PERFIL}
                rangoCatalogo={RANGO}
                aviso={{ precioEstandar: 80_000, pct: 15 }}
                vista={VISTA}
            />,
        );
        expect(screen.getByText(/Cómo se cobra/)).toBeTruthy();
        // Valores EN VIVO, formateados (80.000 con puntos de miles; 15%).
        expect(screen.getByText(/80\.000/)).toBeTruthy();
        expect(screen.getByText(/15%/)).toBeTruthy();
        expect(screen.getByText(/desde la segunda cita/)).toBeTruthy();
    });

    it("si falta un parámetro: la frase va SIN número, nunca una cifra inventada", () => {
        const { container } = render(
            <MiPerfilProfesionalClient
                perfil={PERFIL}
                rangoCatalogo={RANGO}
                aviso={{ precioEstandar: null, pct: null }}
                vista={VISTA}
            />,
        );
        // El marco del aviso sigue estando.
        expect(screen.getByText(/Cómo se cobra/)).toBeTruthy();
        // Pero NO aparece un precio estándar inventado ni un % inventado. La única
        // cifra que puede haber en la pantalla es la tarifa del propio profesional
        // (input), no en el texto del aviso: verificamos que el párrafo del aviso
        // no trae «hoy <número>» ni «(hoy <número>%)».
        const avisoTexto = container.querySelector("p")?.parentElement?.textContent ?? container.textContent ?? "";
        expect(/hoy\s*[\d.]+\s*COP/.test(avisoTexto)).toBe(false);
        expect(/\(hoy\s*\d+%\)/.test(avisoTexto)).toBe(false);
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

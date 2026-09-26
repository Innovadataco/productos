/**
 * SPEC-741 · CANDADO — «Mi perfil» del habilitado: cada sección es PLEGABLE, y plegar
 * OCULTA sin DESMONTAR (mejora de Jelkin, en vivo).
 *
 * Conductas que no se pueden fingir (verificadas por MUTACIÓN):
 *  1. Cada una de las 4 secciones (Sus datos / Su tarifa / Sus documentos / Autorización)
 *     tiene por encabezado un `<button aria-expanded aria-controls>` REAL — no un `<div>`
 *     con onClick: accesible por teclado y lector de pantalla.
 *  2. Un clic en el encabezado ALTERNA plegar/desplegar (aria-expanded true↔false).
 *  3. CONTROL POSITIVO — «no desmontar el form, sólo ocultar»: al plegar, el input de la
 *     sección SIGUE en el DOM (sólo cambia `hidden`). Si alguien volviera `SeccionColapsable`
 *     al patrón del `Accordion` de array (`{abierta ? children : null}`), el input de la
 *     sección plegada desaparecería del DOM y este candado caería en ROJO.
 *
 * (El respeto a prefers-reduced-motion vive en `SeccionColapsable` con el prefijo
 *  `motion-safe:`, que jsdom no evalúa; se cubre con una aserción de fuente al final.)
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
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
const CATALOGOS = {
    profesion: [{ clave: "psicologo", nombre: "Psicólogo/a" }],
    areas: [{ grupo: "Emocional", items: [{ clave: "ansiedad", nombre: "Ansiedad" }] }],
    rangoEtario: [{ clave: "6-11", nombre: "Niñez (6–11)" }],
};
const VISTA = { estadoPerfil: "ACTIVO", puedeReenviar: false, observaciones: [] } as unknown as VistaProfesionalVerificacion;
// La 4ª sección (Autorización) sólo se pinta si hay una versión aceptada (SPEC-686).
const AUTORIZACION = { version: "1.0", aceptadaEn: "2026-01-01T00:00:00.000Z", hayActualizacionMenor: false };

// Las 4 secciones que Jelkin pidió plegables (el bloque «estado de verificación»
// no es una de ellas y por diseño NO es plegable).
const SECCIONES = ["Sus datos", "Su tarifa", "Sus documentos", "Autorización"];

function montar() {
    return render(
        <MiPerfilProfesionalClient
            perfil={PERFIL}
            catalogos={CATALOGOS}
            aviso={{ precioEstandar: 80_000, pct: 15 }}
            vista={VISTA}
            autorizacion={AUTORIZACION}
        />,
    );
}

afterEach(() => cleanup());

describe("SPEC-741 · «Mi perfil»: secciones plegables (ocultar, no desmontar)", () => {
    it("cada una de las 4 secciones tiene por encabezado un <button aria-expanded aria-controls>", () => {
        montar();
        for (const titulo of SECCIONES) {
            const btn = screen.getByRole("button", { name: titulo });
            expect(btn.tagName).toBe("BUTTON");
            // Por defecto abiertas (Diseño puede cambiar el estado inicial; el candado no lo fija).
            expect(btn.getAttribute("aria-expanded")).toBe("true");
            // El encabezado apunta a su panel (region), señal de disclosure accesible real.
            expect(btn.getAttribute("aria-controls")).toBeTruthy();
        }
    });

    it("un clic en el encabezado ALTERNA plegar/desplegar (aria-expanded true↔false)", () => {
        montar();
        const btn = screen.getByRole("button", { name: "Sus datos" });
        expect(btn.getAttribute("aria-expanded")).toBe("true");
        fireEvent.click(btn);
        expect(btn.getAttribute("aria-expanded")).toBe("false");
        fireEvent.click(btn);
        expect(btn.getAttribute("aria-expanded")).toBe("true");
    });

    it("CONTROL POSITIVO · plegar OCULTA sin DESMONTAR: el input de la sección sigue en el DOM", () => {
        montar();
        const btn = screen.getByRole("button", { name: "Su tarifa" });
        const panel = document.getElementById(btn.getAttribute("aria-controls") ?? "");
        expect(panel).not.toBeNull();
        // Abierta: el panel se ve y contiene el input de la tarifa.
        expect(panel!.hasAttribute("hidden")).toBe(false);
        expect(within(panel!).getByLabelText("Tarifa por consulta (COP)")).toBeTruthy();
        // Plegar la sección.
        fireEvent.click(btn);
        expect(btn.getAttribute("aria-expanded")).toBe("false");
        expect(panel!.hasAttribute("hidden")).toBe(true);
        // El input SIGUE montado dentro del panel oculto (no se desmontó el formulario).
        // MUTACIÓN: si `SeccionColapsable` desmontara el contenido al plegar
        // (`{abierta ? children : null}`), este query devolvería null y el candado caería.
        expect(within(panel!).queryByLabelText("Tarifa por consulta (COP)")).not.toBeNull();
    });
});

describe("SPEC-741 · SeccionColapsable: oculta con `hidden`, no desmonta; movimiento sólo motion-safe", () => {
    const src = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/ui/SeccionColapsable.tsx"),
        "utf-8",
    );

    it("el panel se controla con `hidden={!abierta}` y renderiza {children} incondicionalmente", () => {
        expect(src).toContain("hidden={!abierta}");
        expect(src).toContain("{children}");
    });

    it("el movimiento va SÓLO bajo motion-safe (respeta prefers-reduced-motion)", () => {
        expect(src).toContain("motion-safe:");
    });
});

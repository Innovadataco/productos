/**
 * SPEC-741 · CANDADO — «Mi perfil» del habilitado: cada sección es PLEGABLE, plegar OCULTA
 * sin DESMONTAR, y la forma la fijó Diseño (doc 333da98): default TODAS recogidas,
 * INDEPENDIENTE, con marcador ÁMBAR cuando la sección necesita atención.
 *
 * Conductas que no se pueden fingir (verificadas por MUTACIÓN):
 *  1. Cada una de las 4 secciones (Sus datos / Su tarifa / Sus documentos / Autorización)
 *     tiene por encabezado un `<button aria-expanded aria-controls>` REAL y arranca RECOGIDA.
 *  2. INDEPENDIENTE: abrir una sección NO cierra otra (mutación a «exclusivo» → rojo).
 *  3. CONTROL POSITIVO — «no desmontar el form, sólo ocultar»: aun RECOGIDA por defecto, el
 *     input de la sección YA está en el DOM (sólo `hidden`). Si `SeccionColapsable` volviera
 *     al patrón del `Accordion` de array (`{abierta ? children : null}`), el input no existiría
 *     mientras la sección está plegada y este candado caería en ROJO.
 *  4. MARCADOR ÁMBAR: aparece cuando la sección necesita atención (tarifa sin fijar) y NO
 *     cuando está resuelta (control positivo por remoción del discriminador).
 *
 * (El chevron ▸→▾ y que el movimiento vaya sólo bajo motion-safe —respeta prefers-reduced-motion—
 *  se cubren con aserciones de fuente al final: jsdom no evalúa CSS.)
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
    presentacion: "Acompaño a las familias con cuidado y experiencia.",
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
const vistaConDevueltos = (n: number): VistaProfesionalVerificacion =>
    ({
        estadoPerfil: "ACTIVO",
        puedeReenviar: n > 0,
        observaciones: Array.from({ length: n }, (_, i) => ({ requisito: `Documento ${i + 1}`, observacion: "corrija esto" })),
    }) as unknown as VistaProfesionalVerificacion;
// La 4ª sección (Autorización) sólo se pinta si hay una versión aceptada (SPEC-686).
const AUTORIZACION = { version: "1.0", aceptadaEn: "2026-01-01T00:00:00.000Z", hayActualizacionMenor: false };

// Las 4 secciones plegables. El regex ancla en el título: el subtítulo de estado
// («Completos», «Sin fijar», …) se suma al nombre accesible del botón, y así el query lo tolera.
const SECCIONES = ["Sus datos", "Su tarifa", "Sus documentos", "Autorización"];
const cab = (titulo: string) => screen.getByRole("button", { name: new RegExp("^" + titulo) });

function montar({ perfil = {}, vista = VISTA }: { perfil?: Partial<PerfilProfesionalPropioDto>; vista?: VistaProfesionalVerificacion } = {}) {
    return render(
        <MiPerfilProfesionalClient
            perfil={{ ...PERFIL, ...perfil }}
            catalogos={CATALOGOS}
            aviso={{ precioEstandar: 80_000, pct: 15 }}
            vista={vista}
            autorizacion={AUTORIZACION}
        />,
    );
}

afterEach(() => cleanup());

describe("SPEC-741 · «Mi perfil»: secciones plegables (Diseño doc 333da98)", () => {
    it("las 4 secciones tienen <button aria-expanded aria-controls> y arrancan RECOGIDAS", () => {
        montar();
        for (const titulo of SECCIONES) {
            const btn = cab(titulo);
            expect(btn.tagName).toBe("BUTTON");
            // Default de Diseño: TODAS recogidas.
            expect(btn.getAttribute("aria-expanded")).toBe("false");
            expect(btn.getAttribute("aria-controls")).toBeTruthy();
        }
    });

    it("un clic en el encabezado ALTERNA plegar/desplegar (aria-expanded false↔true)", () => {
        montar();
        const btn = cab("Sus datos");
        expect(btn.getAttribute("aria-expanded")).toBe("false");
        fireEvent.click(btn);
        expect(btn.getAttribute("aria-expanded")).toBe("true");
        fireEvent.click(btn);
        expect(btn.getAttribute("aria-expanded")).toBe("false");
    });

    it("INDEPENDIENTE: abrir una sección NO cierra otra", () => {
        montar();
        const datos = cab("Sus datos");
        const docs = cab("Sus documentos");
        fireEvent.click(datos);
        fireEvent.click(docs);
        // Las dos quedan abiertas: abrir «documentos» no plegó «datos».
        // MUTACIÓN a «exclusivo» (un solo Set de una clave) → «datos» se cerraría → rojo.
        expect(datos.getAttribute("aria-expanded")).toBe("true");
        expect(docs.getAttribute("aria-expanded")).toBe("true");
    });

    it("CONTROL POSITIVO · aun RECOGIDA, el input de la sección YA está en el DOM (oculto, no desmontado)", () => {
        montar();
        const btn = cab("Su tarifa");
        const panel = document.getElementById(btn.getAttribute("aria-controls") ?? "");
        expect(panel).not.toBeNull();
        // Recogida por defecto: el panel está oculto…
        expect(btn.getAttribute("aria-expanded")).toBe("false");
        expect(panel!.hasAttribute("hidden")).toBe(true);
        // …pero el input EXISTE (montado bajo `hidden`). MUTACIÓN a `{abierta ? children : null}`
        // → recogida = sin input → este query devolvería null → rojo.
        expect(within(panel!).queryByLabelText("Tarifa por consulta (COP)")).not.toBeNull();
        // Al desplegar, el panel se muestra y el mismo input sigue ahí.
        fireEvent.click(btn);
        expect(panel!.hasAttribute("hidden")).toBe(false);
        expect(within(panel!).getByLabelText("Tarifa por consulta (COP)")).toBeTruthy();
    });

    it("ENCABEZADO INFORMATIVO: cada sección resume su estado bajo el título (sin desplegar)", () => {
        montar(); // fixture: datos completos, tarifa fijada, sin devueltos, autorización aceptada
        expect(cab("Sus datos").textContent).toMatch(/Completos/);
        expect(cab("Su tarifa").textContent).toMatch(/120\.000/);
        expect(cab("Sus documentos").textContent).toMatch(/Al día/);
        expect(cab("Autorización").textContent).toMatch(/Aceptada/);
    });

    it("ÁMBAR de atención en «Sus documentos» cuando hay devueltos; «Al día» cuando no", () => {
        // Un ítem de verificación DEVUELTO → «1 por corregir» en el encabezado (atención).
        montar({ vista: vistaConDevueltos(1) });
        expect(cab("Sus documentos").textContent).toMatch(/1 por corregir/);
        cleanup();
        // Control positivo: sin devueltos → «Al día», sin «por corregir».
        montar({ vista: vistaConDevueltos(0) });
        const docs = cab("Sus documentos");
        expect(docs.textContent).toMatch(/Al día/);
        expect(docs.textContent).not.toMatch(/por corregir/);
    });

    it("ÁMBAR de atención en «Su tarifa» cuando está sin fijar; muestra el valor cuando está fijada", () => {
        montar({ perfil: { tarifaConsultaCOP: null } });
        expect(cab("Su tarifa").textContent).toMatch(/Sin fijar/);
        cleanup();
        // Control positivo: quitá el discriminador (tarifa fijada) → valor, sin «Sin fijar».
        montar({ perfil: { tarifaConsultaCOP: 120_000 } });
        const t = cab("Su tarifa");
        expect(t.textContent).toMatch(/120\.000/);
        expect(t.textContent).not.toMatch(/Sin fijar/);
    });
});

describe("SPEC-741 · SeccionColapsable: oculta con `hidden`, chevron ▸→▾ sólo motion-safe", () => {
    const src = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/ui/SeccionColapsable.tsx"),
        "utf-8",
    );

    it("el panel se controla con `hidden={!abierta}` y renderiza {children} incondicionalmente", () => {
        expect(src).toContain("hidden={!abierta}");
        expect(src).toContain("{children}");
    });

    it("el chevron rota SÓLO bajo motion-safe con ~180ms (respeta prefers-reduced-motion)", () => {
        expect(src).toContain("motion-safe:transition-transform");
        expect(src).toContain("motion-safe:duration-[180ms]");
    });
});

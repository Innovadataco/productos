/**
 * CANDADO · SPEC-965 (FORMA Órbita · UI) — OrbitaColegioMapa.
 *
 * Muere con el defecto:
 *   - PARÁ 1: la capa 1 (colegio, cursos, comité) NUNCA pinta rubí — solo pino/ámbar.
 *   - Capa 2: el rubí aparece SOLO en el nodo de un alumno con alerta alta; el titular y el centro
 *     (curso) nunca son rubí.
 *   - Overview: la capa 2 NUNCA dibuja todos los alumnos — solo los que merecen mirada + «resto: N en
 *     calma».
 *   - Accesible: la órbita (SVG) es decorativa; existe un equivalente en LISTA con botones (teclado /
 *     lector de pantalla).
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { OrbitaColegioMapa } from "./OrbitaColegioMapa";
import type { OrbitaColegio, CursoOrbitaDetalle } from "@/lib/dal/repositories/colegio-resumen";

const ORBITA: OrbitaColegio = {
    cursos: [
        { cursoId: "c1", nombre: "A-1", estudiantes: 20, alertas30d: 3, color: "ambar" },
        { cursoId: "c2", nombre: "A-2", estudiantes: 10, alertas30d: 0, color: "pino" },
        { cursoId: "c3", nombre: "A-3", estudiantes: 8, alertas30d: 1, color: "ambar" },
    ],
    semaforo: { alertasNuevas: 0, alertas72h: 0 },
    casosComite: { abiertos: 1, masViejoEn: new Date() },
    umbralMirada: 1,
};

const DETALLE: CursoOrbitaDetalle = {
    curso: { cursoId: "c1", nombre: "A-1", alertas30d: 3, color: "ambar" },
    titular: { nombre: "Ana Ruiz" },
    alumnosMirada: [
        { estudianteId: "e1", nombre: "Juan Pérez", riesgo: "alta" },
        { estudianteId: "e2", nombre: "Lucía Gómez", riesgo: "sin_contacto" },
    ],
    restoEnCalma: 18,
};

afterEach(() => {
    vi.unstubAllGlobals();
});

function montar() {
    return render(<OrbitaColegioMapa colegioNombre="Colegio San José" colorColegio="ambar" orbita={ORBITA} />);
}

describe("SPEC-965 · OrbitaColegioMapa", () => {
    it("PARÁ 1: la capa 1 no pinta rubí en ningún nodo (colegio, cursos, comité)", () => {
        const { container } = montar();
        expect(container.querySelectorAll(".fill-rubi, .bg-rubi")).toHaveLength(0);
    });

    it("accesible: la capa 1 tiene equivalente en lista con un botón por curso (teclado / lector de pantalla)", () => {
        montar();
        expect(screen.getByRole("button", { name: /Curso A-1\./ })).toBeTruthy();
        expect(screen.getByRole("button", { name: /Curso A-2\./ })).toBeTruthy();
    });

    it("SPEC-968: el chip lleva el sustantivo «reporte(s)» con singular/plural correcto (texto y aria-label)", () => {
        montar();
        // A-3 tiene 1 reporte → «1 reporte» (NO «1 reportes»), en el chip visible y en el aria-label.
        const btnSingular = screen.getByRole("button", { name: /Curso A-3\./ });
        expect(btnSingular.getAttribute("aria-label")).toContain("1 reporte en 30 días");
        expect(btnSingular.getAttribute("aria-label")).not.toContain("1 reportes");
        expect(screen.getByText(/1 reporte · 30 días/)).toBeTruthy();
        // A-1 tiene 3 → plural «3 reportes».
        expect(screen.getByRole("button", { name: /Curso A-1\./ }).getAttribute("aria-label")).toContain(
            "3 reportes en 30 días"
        );
    });

    it("al abrir un curso: el rubí aparece SOLO en el alumno de alerta alta; titular y curso nunca rubí", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({ ok: true, json: async () => ({ curso: DETALLE }) })
        );
        const { container } = montar();
        fireEvent.click(screen.getByRole("button", { name: /Curso A-1\./ }));

        await waitFor(() => expect(screen.getByText("Juan Pérez")).toBeTruthy());

        // El alumno de alerta alta lleva el rubí.
        const filaAlta = screen.getByText("Juan Pérez").closest("li")!;
        expect(within(filaAlta).getByText("alerta alta")).toBeTruthy();
        expect(filaAlta.querySelector(".bg-rubi")).not.toBeNull();

        // El alumno sin contacto va en ámbar (no rubí).
        const filaAmbar = screen.getByText("Lucía Gómez").closest("li")!;
        expect(filaAmbar.querySelector(".bg-rubi")).toBeNull();
        expect(filaAmbar.querySelector(".bg-ambar")).not.toBeNull();

        // SPEC-968: el titular lleva un contorno NEUTRO de contexto, NO un color de estado (ni pino, ni
        // ámbar, ni rubí) — para que el rector no lo lea como «profesor sin novedad».
        const filaTitular = screen.getByText(/Profesor titular/).closest("li")!;
        const puntoTitular = filaTitular.querySelector("span[aria-hidden='true']")!;
        expect(puntoTitular.className).not.toMatch(/bg-(pino|ambar|rubi)\b/);
        expect(puntoTitular.className).toContain("border-tinta");

        // El centro (curso) es ámbar, no rubí.
        const centro = container.querySelector('circle[r="36"]')!;
        expect(centro.classList.contains("fill-ambar")).toBe(true);
        expect(centro.classList.contains("fill-rubi")).toBe(false);
    });

    it("overview: la capa 2 NO dibuja todos los alumnos — solo la mirada + «resto: N en calma»", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({ ok: true, json: async () => ({ curso: DETALLE }) })
        );
        montar();
        fireEvent.click(screen.getByRole("button", { name: /Curso A-1\./ }));
        await waitFor(() => expect(screen.getByText("Juan Pérez")).toBeTruthy());

        // Solo 2 alumnos de mirada dibujados (no los 20).
        expect(screen.queryByText("alerta alta")).toBeTruthy();
        expect(screen.getByText(/Resto: 18 estudiantes en calma/)).toBeTruthy();
        // Cantidad de círculos de mirada en el SVG = alumnosMirada.length (2), no el total del curso.
        const dotsAlumno = screen.getAllByText(/alerta alta|sin contacto/).length;
        expect(dotsAlumno).toBe(2);
    });

    it("SPEC-971: ningún atributo numérico del SVG pasa de 2 decimales (anti-warning de hidratación)", async () => {
        const DECIMALES_MAX = 2;
        // Atributos geométricos que nacen de un cálculo (Math.cos/sin/sqrt) y disparaban el
        // mismatch SSR↔cliente. Los constantes (viewBox, strokeWidth) son enteros.
        const ATTRS = ["cx", "cy", "x1", "y1", "x2", "y2", "r"];
        const decimales = (v: string): number => {
            const punto = v.indexOf(".");
            return punto < 0 ? 0 : v.length - punto - 1;
        };
        const verificarSvg = (root: ParentNode): number => {
            let revisados = 0;
            root.querySelectorAll("svg *").forEach((el) => {
                for (const attr of ATTRS) {
                    const v = el.getAttribute(attr);
                    if (v === null || v === "") continue;
                    expect(Number.isNaN(Number(v)), `${attr}="${v}" no es numérico`).toBe(false);
                    expect(
                        decimales(v),
                        `${attr}="${v}" excede ${DECIMALES_MAX} decimales (redondeá la coordenada)`,
                    ).toBeLessThanOrEqual(DECIMALES_MAX);
                    revisados += 1;
                }
            });
            return revisados;
        };

        // Capa 1: cursos + comité + centro (cx/cy calculados, r = radioNodo con sqrt).
        const { container } = montar();
        // Control positivo: si no revisó ningún atributo, el candado no vigila nada.
        expect(verificarSvg(container)).toBeGreaterThan(0);

        // Capa 2: alumnos de mirada + titular + resto (más coordenadas calculadas).
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({ ok: true, json: async () => ({ curso: DETALLE }) }),
        );
        fireEvent.click(screen.getByRole("button", { name: /Curso A-1\./ }));
        await waitFor(() => expect(screen.getByText("Juan Pérez")).toBeTruthy());
        expect(verificarSvg(container)).toBeGreaterThan(0);
    });
});

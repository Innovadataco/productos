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

        // El titular nunca es rubí.
        const filaTitular = screen.getByText(/Profesor titular/).closest("li")!;
        expect(filaTitular.querySelector(".bg-rubi")).toBeNull();
        expect(filaTitular.querySelector(".bg-pino")).not.toBeNull();

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
});

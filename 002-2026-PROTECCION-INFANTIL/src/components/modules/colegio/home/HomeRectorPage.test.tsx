/**
 * SPEC-143 (T009, FR-014) — HomeRectorPage: composición completa por estado del
 * semáforo — saludo con nombre, KPIs (solo activos), anillos, tendencia, acciones
 * y canales oficiales. Terminología §3 verificada sobre el render completo.
 */
import React from "react";
import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomeRectorPage } from "./HomeRectorPage";
import type { HomeRector } from "@/lib/dal/repositories/colegio-resumen";

beforeAll(() => {
    class ResizeObserverStub {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
    Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverStub, writable: true });
});

function fixture(parcial: Partial<HomeRector> = {}): HomeRector {
    return {
        colegio: { nombre: "Colegio San José", vigenciaFin: null },
        kpis: { estudiantes: 10, cursos: 2, profesores: 1, acudientes: 5, reportesMes: 4, reportesSemana: 2, deltaSemana: 1 },
        cobertura: { vigilancia: 0.7, reaccion: 0.5, sinRedes: 3, sinContacto: 5 },
        semaforo: { alertasNuevas: 0, alertas72h: 0 },
        ultimaSenal: new Date(),
        latidoSistema: new Date(),
        tendencia: {
            semanal: [{ periodo: "2026-07-27T00:00:00.000Z", reportes: 2 }],
            mensual: [{ periodo: "2026-08-01T00:00:00.000Z", reportes: 4 }],
            anual: [{ periodo: "2026-01-01T00:00:00.000Z", reportes: 4 }],
        },
        cursosMirada: [{ cursoId: "c1", nombre: "8-B", profesorTitular: "María López", alertas30d: 2 }],
        embudo: { recibidos: 4, cerrados: 1, enRevision: 2, teEsperan: 1 },
        // SPEC-353 (C6): insumos de la frase "qué hacer hoy".
        casosComite: { abiertos: 0, masViejoEn: null },
        ultimaAlertaSinAbrirEn: null,
        identificadorCruzado: { identificadores: 0, estudiantesMax: 0 },
        ...parcial,
    };
}

describe("HomeRectorPage", () => {
    it("compone la home: saludo, KPIs, anillos, tendencia, cursos, acciones y canales oficiales", () => {
        render(<HomeRectorPage nombreUsuario="Rectora Pérez" datos={fixture()} />);
        expect(screen.getByText(/Rectora Pérez\./)).toBeTruthy();
        expect(screen.getByText(/Hoy es /)).toBeTruthy();
        // KPIs (los textos "Cursos"/"Profesores" también aparecen en Acciones)
        expect(screen.getByText("Estudiantes")).toBeTruthy();
        expect(screen.getAllByText("Profesores").length).toBeGreaterThan(0);
        expect(screen.getByText("Reportes este mes")).toBeTruthy();
        // Anillos 70/50
        expect(screen.getByRole("img").getAttribute("aria-label")).toContain("70%");
        // Cursos que merecen mirada
        expect(screen.getByText("8-B")).toBeTruthy();
        // Acciones + canales oficiales
        expect(screen.getByRole("link", { name: /Crear curso y estudiantes/ })).toBeTruthy();
        expect(screen.getByText("Canales oficiales de denuncia")).toBeTruthy();
        expect(screen.getByText("Línea 141")).toBeTruthy();
        expect(screen.getByText("Te Protejo")).toBeTruthy();
    });

    it("estado pino: declaración tranquila", () => {
        render(<HomeRectorPage nombreUsuario="X" datos={fixture()} />);
        expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("tranquilo");
    });

    it("estado PENDIENTE (≥1 nueva, D-120: ámbar): urgencia «actúe hoy» con CTA", () => {
        render(<HomeRectorPage nombreUsuario="X" datos={fixture({ semaforo: { alertasNuevas: 2, alertas72h: 2 } })} />);
        expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("necesita que actúe hoy");
        const ctas = screen.getAllByRole("link", { name: /Ver alertas/ });
        expect(ctas.length).toBeGreaterThanOrEqual(1);
        for (const cta of ctas) expect(cta.getAttribute("href")).toBe("/dashboard/colegio/alertas");
    });

    it("estado ATENDIDO (72 h sin nuevas, D-120: pino): el copy dice que ya está atendido", () => {
        render(<HomeRectorPage nombreUsuario="X" datos={fixture({ semaforo: { alertasNuevas: 0, alertas72h: 1 } })} />);
        expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("ya lo atendió");
    });

    it("I-29 y terminología §3: cero scores, cero jerga, cero palabras prohibidas", () => {
        const { container } = render(<HomeRectorPage nombreUsuario="X" datos={fixture()} />);
        const texto = (container.textContent ?? "").toLowerCase();
        for (const prohibida of ["alumno", "carga masiva", "gestión de", "score", "confianza ia", "pipeline", "worker", "tenant"]) {
            expect(texto).not.toContain(prohibida);
        }
    });
});

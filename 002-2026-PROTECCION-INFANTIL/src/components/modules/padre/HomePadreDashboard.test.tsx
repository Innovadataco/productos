/**
 * SPEC-309 (A-50): tests unitarios de HomePadreDashboard.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomePadreDashboard } from "./HomePadreDashboard";
import type { HomePadrePayload } from "@/lib/padre/home";

const payloadBase: HomePadrePayload = {
    saludo: "Buenos días, Carlos",
    fechaHoy: "viernes, 28 de agosto de 2026",
    resumen: { totalContactos: 3, sinReportes: 1, enRevision: 1, clasificados: 1 },
    semaforo: [
        { id: "c1", etiqueta: "Hijo", color: "ROJO", totalReportes: 2 },
        { id: "c2", etiqueta: "Sobrina", color: "VERDE", totalReportes: 0 },
    ],
    timeline: [
        {
            id: "e1",
            fechaEvento: new Date("2026-08-27T10:00:00Z"),
            texto: "Nuevo reporte clasificado",
            categoria: "SOLICITUD_MATERIAL",
            contactoEtiqueta: "Hijo",
            expedienteId: "exp1",
        },
    ],
    sugerencia: {
        texto: "Revisa el expediente de tu hijo",
        accionHref: "/dashboard/padre/expedientes",
        accionTexto: "Ver expedientes",
        prioridad: "alta",
    },
    accesos: [
        { label: "Reportar", href: "/dashboard/padre/reportar" },
        { label: "Círculo", href: "/dashboard/padre/circulo-confianza" },
    ],
};

describe("HomePadreDashboard", () => {
    it("renderiza saludo, fecha y todos los bloques principales", () => {
        render(<HomePadreDashboard data={payloadBase} />);

        expect(screen.getByText("Buenos días, Carlos")).toBeTruthy();
        expect(screen.getByText(/viernes, 28 de agosto de 2026/i)).toBeTruthy();
        expect(screen.getByText(/Sugerencia del día/i)).toBeTruthy();
        expect(screen.getByText(/Círculo de confianza/i)).toBeTruthy();
        expect(screen.getByText(/Semáforo de atención/i)).toBeTruthy();
        expect(screen.getByText(/Eventos recientes/i)).toBeTruthy();
        expect(screen.getByText(/Accesos rápidos/i)).toBeTruthy();
    });

    it("muestra sugerencia y acción destacada", () => {
        render(<HomePadreDashboard data={payloadBase} />);
        expect(screen.getByText(/Revisa el expediente de tu hijo/i)).toBeTruthy();
        const link = screen.getByRole("link", { name: /Ver expedientes/i });
        expect(link.getAttribute("href")).toBe("/dashboard/padre/expedientes");
    });

    it("renderiza contactos del semáforo y eventos del timeline", () => {
        render(<HomePadreDashboard data={payloadBase} />);
        expect(screen.getByText("Hijo")).toBeTruthy();
        expect(screen.getByText("Sobrina")).toBeTruthy();
        expect(screen.getByText("Nuevo reporte clasificado")).toBeTruthy();
    });

    it("soporta estado vacío sin contactos ni eventos", () => {
        const vacio: HomePadrePayload = {
            saludo: "Buenos días",
            fechaHoy: "hoy",
            resumen: { totalContactos: 0, sinReportes: 0, enRevision: 0, clasificados: 0 },
            semaforo: [],
            timeline: [],
            sugerencia: {
                texto: "Aún no tienes contactos",
                accionHref: "/dashboard/padre/circulo-confianza",
                accionTexto: "Agregar contacto",
                prioridad: "baja",
            },
            accesos: [{ label: "Círculo", href: "/dashboard/padre/circulo-confianza" }],
        };

        render(<HomePadreDashboard data={vacio} />);
        expect(screen.getByText(/Agrega contactos para ver su nivel de atención/i)).toBeTruthy();
        expect(screen.getByText(/No hay eventos registrados/i)).toBeTruthy();
        expect(screen.getByText("Agregar contacto")).toBeTruthy();
    });
});

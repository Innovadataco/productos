import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpamReportesTabla } from "./SpamReportesTabla";
import type { SpamReporteItem } from "./types";

const reporteBase: SpamReporteItem = {
    id: "r1",
    identificador: "5551234",
    plataforma: { id: "p1", nombre: "WhatsApp", clave: "whatsapp" },
    texto: "texto",
    estado: "POSIBLE_SPAM",
    creadoEn: "2026-08-21T12:00:00Z",
    prioridadAlta: false,
    operadorId: null,
    asignadoA: { id: "op1", nombre: "Ana", email: "ana@example.com" },
    clasificacion: { categoria: "CONTACTO_INSISTENTE", confianza: 0.8 },
    confianzaSpam: 0.92,
    motivoIngreso: "spam_confianza_alta",
};

describe("SpamReportesTabla", () => {
    it("muestra estado de carga", () => {
        render(
            <SpamReportesTabla
                reportes={[]}
                loading
                page={1}
                totalPages={1}
                total={0}
                onReview={vi.fn()}
                onPageChange={vi.fn()}
            />
        );

        expect(document.querySelector("[role='status']") ?? document.querySelector(".animate-spin")).toBeTruthy();
    });

    it("muestra empty state cuando no hay reportes", () => {
        render(
            <SpamReportesTabla
                reportes={[]}
                loading={false}
                page={1}
                totalPages={1}
                total={0}
                onReview={vi.fn()}
                onPageChange={vi.fn()}
            />
        );

        expect(screen.getByText("No hay reportes en revisión de spam")).toBeTruthy();
    });

    it("renderiza filas y dispara onReview", () => {
        const onReview = vi.fn();
        render(
            <SpamReportesTabla
                reportes={[reporteBase]}
                loading={false}
                page={1}
                totalPages={1}
                total={1}
                onReview={onReview}
                onPageChange={vi.fn()}
            />
        );

        expect(screen.getByText("5551234")).toBeTruthy();
        expect(screen.getByText("WhatsApp")).toBeTruthy();
        expect(screen.getByText("92.0%")).toBeTruthy();
        expect(screen.getByText("Ana")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "Revisar" }));
        expect(onReview).toHaveBeenCalledWith("r1");
    });

    it("muestra porcentaje y badge para spam_dominancia", () => {
        render(
            <SpamReportesTabla
                reportes={[{ ...reporteBase, confianzaSpam: 0.33, motivoIngreso: "spam_dominancia" }]}
                loading={false}
                page={1}
                totalPages={1}
                total={1}
                onReview={vi.fn()}
                onPageChange={vi.fn()}
            />
        );

        expect(screen.getByText("33.0%")).toBeTruthy();
        expect(screen.getByText("Dominancia de otra categoría")).toBeTruthy();
    });

    it("muestra 'Regla determinística' sin porcentaje para spam_publicitario_deterministico", () => {
        render(
            <SpamReportesTabla
                reportes={[{ ...reporteBase, confianzaSpam: null, motivoIngreso: "spam_publicitario_deterministico" }]}
                loading={false}
                page={1}
                totalPages={1}
                total={1}
                onReview={vi.fn()}
                onPageChange={vi.fn()}
            />
        );

        expect(screen.getByText("Regla determinística")).toBeTruthy();
        expect(screen.queryByText(/NaN/)).toBeNull();
    });

    it("muestra guión sin porcentaje para motivo desconocido", () => {
        render(
            <SpamReportesTabla
                reportes={[{ ...reporteBase, confianzaSpam: null, motivoIngreso: "desconocido" }]}
                loading={false}
                page={1}
                totalPages={1}
                total={1}
                onReview={vi.fn()}
                onPageChange={vi.fn()}
            />
        );

        expect(screen.getByText("Sin datos suficientes")).toBeTruthy();
        expect(screen.queryByText(/NaN/)).toBeNull();
    });

    it("defense-in-depth: confianzaSpam null en spam_confianza_alta no rompe con NaN%", () => {
        render(
            <SpamReportesTabla
                reportes={[{ ...reporteBase, confianzaSpam: null, motivoIngreso: "spam_confianza_alta" }]}
                loading={false}
                page={1}
                totalPages={1}
                total={1}
                onReview={vi.fn()}
                onPageChange={vi.fn()}
            />
        );

        expect(screen.queryByText(/NaN/)).toBeNull();
    });

    it("muestra guión cuando no hay operador asignado", () => {
        render(
            <SpamReportesTabla
                reportes={[{ ...reporteBase, asignadoA: null }]}
                loading={false}
                page={1}
                totalPages={1}
                total={1}
                onReview={vi.fn()}
                onPageChange={vi.fn()}
            />
        );

        expect(screen.getByText("—")).toBeTruthy();
    });

    it("renderiza paginación y navega", () => {
        const onPageChange = vi.fn();
        render(
            <SpamReportesTabla
                reportes={[reporteBase]}
                loading={false}
                page={2}
                totalPages={3}
                total={75}
                onReview={vi.fn()}
                onPageChange={onPageChange}
            />
        );

        expect(screen.getByText("Página 2 de 3 · 75 reportes")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
        expect(onPageChange).toHaveBeenCalledWith(1);

        fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
        expect(onPageChange).toHaveBeenCalledWith(3);
    });

    it("deshabilita botones de paginación en los extremos", () => {
        render(
            <SpamReportesTabla
                reportes={[reporteBase]}
                loading={false}
                page={1}
                totalPages={2}
                total={50}
                onReview={vi.fn()}
                onPageChange={vi.fn()}
            />
        );

        expect((screen.getByRole("button", { name: "Anterior" }) as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByRole("button", { name: "Siguiente" }) as HTMLButtonElement).disabled).toBe(false);
    });
});

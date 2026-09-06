import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TarjetaMetrica } from "./TarjetaMetrica";

describe("TarjetaMetrica", () => {
    it("disposición centrada: valor arriba y etiqueta abajo", () => {
        render(<TarjetaMetrica label="Reportes registrados" value={42} />);
        const article = screen.getByText("Reportes registrados").closest("article");
        expect(article).toBeTruthy();
        const valor = screen.getByText("42");
        expect(valor.className).toContain("text-3xl");
        expect(article?.className).toContain("text-center");
    });

    it("disposición panel: etiqueta arriba y valor abajo", () => {
        render(<TarjetaMetrica label="En cola" value={7} disposicion="panel" />);
        const article = screen.getByText("En cola").closest("article");
        expect(article?.className).toContain("p-6");
        expect(article?.className).not.toContain("text-center");
    });

    it("SPEC-537 · tone up (ámbar, sube riesgo) y down (pino, baja riesgo) al valor — nunca rubí", () => {
        const { rerender } = render(<TarjetaMetrica label="Subidas" value={3} tone="up" />);
        expect(screen.getByText("3").className).toContain("text-estado-ambar");
        expect(screen.getByText("3").className).not.toContain("rubi");
        rerender(<TarjetaMetrica label="Bajadas" value={2} tone="down" />);
        expect(screen.getByText("2").className).toContain("text-estado-pino");
    });

    it("renderiza suffix y sub cuando se proporcionan", () => {
        render(<TarjetaMetrica label="Cobertura" value={95} suffix="%" sub="activos" />);
        expect(screen.getByText("%")).toBeTruthy();
        expect(screen.getByText("activos")).toBeTruthy();
    });

    it("mono: valor en font-mono text-2xl", () => {
        render(<TarjetaMetrica label="Total reportes" value="abc-123" mono />);
        const valor = screen.getByText("abc-123");
        expect(valor.className).toContain("font-mono");
        expect(valor.className).toContain("text-2xl");
    });
});

/**
 * SPEC-143 (T005, D3) — FranjaVigilancia: los DOS hechos con sus etiquetas
 * correctas y la semana con delta en texto humano (solo verdades, sin "-0").
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FranjaVigilancia } from "./FranjaVigilancia";

const AHORA = new Date();

describe("FranjaVigilancia", () => {
    it("muestra los DOS hechos de D3 con sus etiquetas: señal del colegio y revisión del sistema", () => {
        render(
            <FranjaVigilancia
                ultimaSenal={new Date(AHORA.getTime() - 12 * 60_000)}
                latidoSistema={new Date(AHORA.getTime() - 5 * 60_000)}
                reportesSemana={2}
                deltaSemana={-1}
            />
        );
        expect(screen.getByText("Última señal sobre su colegio")).toBeTruthy();
        expect(screen.getByText("hace 12 minutos")).toBeTruthy();
        expect(screen.getByText("Última revisión del sistema")).toBeTruthy();
        expect(screen.getByText("hace 5 minutos")).toBeTruthy();
        expect(screen.getByText(/2 reportes recibidos/)).toBeTruthy();
        expect(screen.getByText(/1 menos que la semana anterior/)).toBeTruthy();
    });

    it("sin señales jamás: copy honesto en positivo (la vigilancia está activa)", () => {
        render(
            <FranjaVigilancia ultimaSenal={null} latidoSistema={null} reportesSemana={0} deltaSemana={0} />
        );
        expect(screen.getByText(/Sin señales aún — la vigilancia está activa/)).toBeTruthy();
        expect(screen.getByText(/Sin registro de revisión aún/)).toBeTruthy();
        expect(screen.getByText(/igual que la semana anterior/)).toBeTruthy();
    });

    it("delta positivo se dice en texto, nunca '-0' ni porcentaje", () => {
        render(
            <FranjaVigilancia ultimaSenal={null} latidoSistema={AHORA} reportesSemana={1} deltaSemana={3} />
        );
        expect(screen.getByText(/1 reporte recibido/)).toBeTruthy();
        expect(screen.getByText(/3 más que la semana anterior/)).toBeTruthy();
    });
});

/**
 * SPEC-143 (T005, D3) + SPEC-670 / I-396 — FranjaVigilancia: los hechos con sus
 * etiquetas correctas y, en (b), el estado del MOTOR de clasificación (no el
 * latido del worker) con el candado que impide afirmar calma sin señal real.
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FranjaVigilancia } from "./FranjaVigilancia";
import type { LatidoMotor } from "@/lib/monitoreo/latido-motor";

const AHORA = new Date();
const vivo = (min = 5): LatidoMotor => ({ motorVivo: true, ultimaVerificacionEn: new Date(AHORA.getTime() - min * 60_000) });
const caido = (ultima: Date | null): LatidoMotor => ({ motorVivo: false, ultimaVerificacionEn: ultima });

describe("FranjaVigilancia (SPEC-143 · SPEC-670)", () => {
    it("los hechos del colegio: señal del colegio y la semana con delta en texto", () => {
        render(
            <FranjaVigilancia
                ultimaSenal={new Date(AHORA.getTime() - 12 * 60_000)}
                motor={vivo(5)}
                reportesSemana={2}
                deltaSemana={-1}
            />
        );
        expect(screen.getByText("Última señal sobre su colegio")).toBeTruthy();
        expect(screen.getByText("hace 12 minutos")).toBeTruthy();
        expect(screen.getByText(/2 reportes recibidos/)).toBeTruthy();
        expect(screen.getByText(/1 menos que la semana anterior/)).toBeTruthy();
    });

    it("motor VIVO: «Clasificación activa» + reloj de la última clasificación real", () => {
        render(<FranjaVigilancia ultimaSenal={null} motor={vivo(5)} reportesSemana={0} deltaSemana={0} />);
        expect(screen.getByText("Clasificación activa")).toBeTruthy();
        expect(screen.getByText(/El sistema está revisando los reportes con normalidad/)).toBeTruthy();
        expect(screen.getByText(/Última clasificación:/)).toBeTruthy();
        expect(screen.getByText("hace 5 minutos")).toBeTruthy();
    });

    it("delta positivo en texto, nunca '-0' ni porcentaje", () => {
        render(<FranjaVigilancia ultimaSenal={null} motor={vivo()} reportesSemana={1} deltaSemana={3} />);
        expect(screen.getByText(/1 reporte recibido/)).toBeTruthy();
        expect(screen.getByText(/3 más que la semana anterior/)).toBeTruthy();
    });
});

// El candado que cierra I-396: la calma NO se puede afirmar sin señal fresca del
// motor. Se ejerce en la cara que fallaba —motor caído— no solo en la que anda.
describe("candado · SPEC-670 / I-396 · la franja no miente frescura", () => {
    it("motor CAÍDO: NO dice «Clasificación activa»; dice «en pausa» en ámbar, sin sonar a pérdida", () => {
        const { container } = render(
            <FranjaVigilancia
                ultimaSenal={null}
                motor={caido(new Date(AHORA.getTime() - 40 * 60_000))}
                reportesSemana={0}
                deltaSemana={0}
            />
        );
        // La mentira de hoy: el estado de calma NO puede aparecer con el motor caído.
        expect(screen.queryByText("Clasificación activa")).toBeNull();
        expect(screen.queryByText(/revisando los reportes con normalidad/)).toBeNull();
        // El estado honesto, en ámbar (interno; nunca rubí) y sin pánico de pérdida.
        expect(screen.getByText("Clasificación en pausa")).toBeTruthy();
        expect(screen.getByText(/se siguen recibiendo y quedan guardados/)).toBeTruthy();
        expect(container.innerHTML).toContain("ambar");
        expect(container.innerHTML).not.toContain("rubi");
        // El reloj muestra el dato real: acá delata cuánto lleva detenido.
        expect(screen.getByText("hace 40 minutos")).toBeTruthy();
    });

    it("SIN señal (ultimaVerificacionEn=null): NO hay reloj — mejor sin dato que uno inventado", () => {
        render(<FranjaVigilancia ultimaSenal={null} motor={caido(null)} reportesSemana={0} deltaSemana={0} />);
        expect(screen.getByText("Clasificación en pausa")).toBeTruthy();
        // Nunca un «hace un momento» fijo ni ningún reloj cuando no hay señal real.
        expect(screen.queryByText(/Última clasificación:/)).toBeNull();
        expect(screen.queryByText(/hace/)).toBeNull();
    });

    it("motor VIVO: aparece la calma (la otra cara — un candado de un solo lado no vigila)", () => {
        render(<FranjaVigilancia ultimaSenal={null} motor={vivo(3)} reportesSemana={0} deltaSemana={0} />);
        expect(screen.getByText("Clasificación activa")).toBeTruthy();
        expect(screen.queryByText("Clasificación en pausa")).toBeNull();
    });
});

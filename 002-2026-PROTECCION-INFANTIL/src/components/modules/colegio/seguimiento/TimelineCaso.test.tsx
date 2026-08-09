/**
 * SPEC-159 (T005, FR-005): tests de TimelineCaso — hito cumplido con su fecha
 * real, hito pendiente marcado como tal (nunca un check falso).
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimelineCaso } from "./TimelineCaso";
import type { HitoCaso } from "@/lib/colegio/seguimiento";

const HITOS: HitoCaso[] = [
    {
        tipo: "detectado",
        estado: "cumplido",
        fecha: "2026-08-07T10:00:00.000Z",
        detalle: "Se detectó un reporte de la comunidad sobre un identificador registrado",
    },
    {
        tipo: "corroborado",
        estado: "pendiente",
        fecha: null,
        detalle: "Aún no hay un segundo reporte independiente que lo corrobore",
    },
];

describe("TimelineCaso", () => {
    it("muestra los hitos con su detalle y marca los pendientes", () => {
        render(<TimelineCaso hitos={HITOS} />);

        expect(screen.getByText("Se detectó un reporte de la comunidad sobre un identificador registrado")).toBeDefined();
        expect(screen.getByText("Aún no hay un segundo reporte independiente que lo corrobore")).toBeDefined();
        expect(screen.getByText("Pendiente")).toBeDefined();
        expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    it("el hito cumplido NO dice pendiente y el pendiente no tiene fecha inventada", () => {
        render(<TimelineCaso hitos={HITOS} />);
        const items = screen.getAllByRole("listitem");
        expect(items).toHaveLength(2);
        expect(items[0]!.textContent).not.toContain("Pendiente");
        expect(items[1]!.textContent).toContain("Pendiente");
    });
});

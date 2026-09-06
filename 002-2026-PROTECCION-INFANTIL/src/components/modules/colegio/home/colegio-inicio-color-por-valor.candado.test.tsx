/**
 * SPEC-551 · CANDADO: en el inicio (colegio + KPI del padre) el color codifica
 * VALOR. El rubi es criticidad REAL nombrada; los pendientes / la cobertura / el
 * conteo «Clasificados» son ATENCIÓN → ámbar, nunca rojo (§3.1 · §7.9 gauges sin
 * rojo · SPEC-489 ring del padre nunca rojo).
 *
 * Como el color es por valor, el candado afirma el MAPEO (no la mera ausencia de
 * crudo). Muere si un pendiente/cobertura/conteo vuelve a rubi, y también muere si
 * alguien barre de más el rubi de SemaforoItem (criticidad real, que SE CONSERVA).
 *
 * Integración (jsdom) por el glob src/**: no toca vitest.unit.includes.ts.
 *
 * NOTA: el hero (HeroEstado «necesita que actúe hoy») NO se incluye: remapearlo a
 * ámbar choca con la D1 de SPEC-143 (ámbar = «ya atendido, nada pendiente»). Ese
 * conflicto lo arbitra el CEO/Diseño; este candado cubre lo no-ambiguo.
 */
import React from "react";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
    default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import { colorPorPorcentaje } from "@/components/modules/colegio/AnillosCobertura";
import { EmbudoEstado } from "@/components/modules/colegio/home/EmbudoEstado";
import { ResumenCirculo } from "@/components/modules/padre/ResumenCirculo";

const SRC = path.resolve(__dirname, "..", "..", "..", ".."); // .../src

describe("SPEC-551 · color por valor en el inicio (rubi solo para criticidad real)", () => {
    it("B · gauge de cobertura: el mapeo NUNCA es rubi (baja/total0 = ámbar, 100% = pino)", () => {
        expect(colorPorPorcentaje(0, 0)).toBe("ambar");    // aún no hay a quién cubrir
        expect(colorPorPorcentaje(0.3, 10)).toBe("ambar"); // cobertura baja = atención
        expect(colorPorPorcentaje(0.5, 10)).toBe("ambar");
        expect(colorPorPorcentaje(0.99, 10)).toBe("ambar");
        expect(colorPorPorcentaje(1, 10)).toBe("pino");    // cobertura completa
        for (const [p, t] of [[0, 0], [0.1, 5], [0.49, 5], [0.9, 5], [1, 5]] as const) {
            expect(colorPorPorcentaje(p, t)).not.toBe("rubi");
        }
    });

    it("B · embudo del rector: los pendientes destacan en ámbar, no en rubi; voz usted", () => {
        const { container } = render(
            <EmbudoEstado embudo={{ recibidos: 9, cerrados: 4, enRevision: 2, teEsperan: 3 }} />,
        );
        const tile = container.querySelector('[data-estado-esperan="pendiente"]') as HTMLElement;
        expect(tile).toBeTruthy();
        expect(tile.className).toContain("bg-ambar/10");
        expect(tile.className).toContain("ring-ambar/40");
        expect(tile.querySelector(".cifra")?.className).toContain("text-estado-ambar");
        expect(tile.outerHTML).not.toContain("rubi");
        // voz: rector = usted
        expect(screen.getByText("Le esperan")).toBeTruthy();
        expect(screen.queryByText("Te esperan a ti")).toBeNull();
    });

    it("C · KPI «Clasificados» del padre: ámbar (atención), no rubi", () => {
        const { container } = render(
            <ResumenCirculo resumen={{ totalContactos: 5, sinReportes: 2, enRevision: 1, clasificados: 2 }} />,
        );
        const clasif = screen.getByText("Clasificados").closest("div") as HTMLElement;
        expect(clasif.className).toContain("bg-ambar/10");
        expect(clasif.querySelector("p")?.className).toContain("text-estado-ambar");
        expect(clasif.outerHTML).not.toContain("rubi");
    });

    it("contraprueba: SemaforoItem CONSERVA rubi para la criticidad real (no se barre de más)", () => {
        const src = fs.readFileSync(path.join(SRC, "components/modules/padre/SemaforoItem.tsx"), "utf-8");
        // El estado ROJO (alerta prioritaria / expediente rojo) sigue en rubi.
        expect(src).toMatch(/ROJO:\s*\{[\s\S]*?clase:\s*"bg-rubi/);
    });
});

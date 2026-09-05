/**
 * SPEC-493 · afinado de forma: dashboard-público + profesional (concretos).
 *
 * Conducta, muere por mutación:
 *  - PublicDashboard: skeleton en token (`bg-tinta/5`), 0 slate crudo.
 *  - MapaUbicaciones: chrome sin crudo slate/amber (la paleta de pins de SPEC-370
 *    es data-viz por hex, no clases Tailwind → no la toca este candado).
 *  - BarChart + PanelProfesional: 0 `text-[10px]` en labels (escala 11px del sistema).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const MODULES = path.resolve(__dirname);
const leer = (rel: string) => fs.readFileSync(path.join(MODULES, rel), "utf-8");

const CRUDO = /\b(?:text|bg|border|ring|from|to|via|divide|fill|stroke)(?:-[ltrbxy])?-(?:slate|gray|amber|emerald)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/;

describe("SPEC-493 · dashboard-público + profesional (forma)", () => {
    it("PublicDashboard: skeleton sin slate crudo (token bg-tinta/5)", () => {
        const src = leer("PublicDashboard.tsx");
        const hits = src.split("\n").map((l, i) => ({ l, i })).filter(({ l }) => CRUDO.test(l)).map(({ l, i }) => `:${i + 1} ${l.trim().slice(0, 70)}`);
        expect(hits, hits.join("\n")).toEqual([]);
    });

    it("MapaUbicaciones: chrome sin crudo slate/amber (paleta de pins data-viz exenta, es hex)", () => {
        const src = leer("MapaUbicaciones.tsx");
        const hits = src.split("\n").map((l, i) => ({ l, i })).filter(({ l }) => CRUDO.test(l)).map(({ l, i }) => `:${i + 1} ${l.trim().slice(0, 70)}`);
        expect(hits, hits.join("\n")).toEqual([]);
    });

    it("BarChart + PanelProfesional: 0 text-[10px] en labels (escala 11px)", () => {
        expect(leer("BarChart.tsx")).not.toMatch(/text-\[10px\]/);
        expect(leer("profesional/PanelProfesional.tsx")).not.toMatch(/text-\[10px\]/);
    });
});

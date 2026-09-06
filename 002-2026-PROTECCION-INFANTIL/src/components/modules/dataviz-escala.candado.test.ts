/**
 * SPEC-537 · data-viz CON escala. Acá el color CODIFICA el valor, así que el candado afirma
 * el MAPEO umbral→token — NO la ausencia de crudo. Muere si se mueve un corte o se cambia el
 * token de un tramo. Cubre las tres piezas que Diseño escaló (MAPA-ESCALA-DATAVIZ):
 *   · AdminDashboard · salud del motor: [0,0.7)→rubí, [0.7,0.9)→ámbar, [0.9,1]→pino (rubí SÍ,
 *     criticidad OPERATIVA real; distinto del gauge de confianza de un caso §7.9, sin rojo).
 *   · TarjetaMetrica · dirección: up→ámbar, down→pino, sin dirección→body (NUNCA rubí: una
 *     flecha de tendencia no es una alarma).
 *   · Sparkline · serie única: línea/área/puntos→cielo, ejes→tinta, halo→papel (sin crudo).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { precisionColorClass } from "./escala-salud-motor";
import { toneClass } from "@/components/ui/TarjetaMetrica";

describe("SPEC-537 · AdminDashboard · salud del motor: umbral→token (rubí = criticidad real)", () => {
    it("tramo CRÍTICO [0, 0.7) → rubí", () => {
        for (const v of [0, 0.3, 0.5, 0.69, 0.6999]) {
            expect(precisionColorClass(v), `precisión ${v}`).toBe("bg-rubi/10 text-rubi");
        }
    });
    it("tramo ATENCIÓN [0.7, 0.9) → ámbar (NO rubí)", () => {
        for (const v of [0.7, 0.8, 0.89, 0.8999]) {
            expect(precisionColorClass(v), `precisión ${v}`).toBe("bg-ambar/10 text-ambar");
        }
    });
    it("tramo SANO [0.9, 1] → pino", () => {
        for (const v of [0.9, 0.95, 1]) {
            expect(precisionColorClass(v), `precisión ${v}`).toBe("bg-pino/10 text-pino");
        }
    });
    it("los cortes son 0.7 y 0.9 EXACTOS (mover el corte cae)", () => {
        expect(precisionColorClass(0.6999), "0.6999 aún es crítico").toContain("rubi");
        expect(precisionColorClass(0.7), "0.7 ya NO es rubí").toContain("ambar");
        expect(precisionColorClass(0.8999), "0.8999 aún es atención").toContain("ambar");
        expect(precisionColorClass(0.9), "0.9 ya es sano").toContain("pino");
    });
});

describe("SPEC-537 · TarjetaMetrica · dirección→token (una flecha no es alarma)", () => {
    it("up (sube riesgo) → ámbar, NUNCA rubí ni rojo crudo", () => {
        expect(toneClass("up")).toBe("text-estado-ambar");
        expect(toneClass("up")).not.toContain("rubi");
        expect(toneClass("up")).not.toContain("red");
    });
    it("down (baja riesgo) → pino", () => {
        expect(toneClass("down")).toBe("text-estado-pino");
    });
    it("sin dirección → texto neutro (body), sin color de estado", () => {
        expect(toneClass(undefined)).toBe("text-body");
    });
});

describe("SPEC-537 · Sparkline · serie única mapeada (sin crudo, sin escala por valor)", () => {
    const src = fs.readFileSync(path.join(__dirname, "Sparkline.tsx"), "utf-8");
    const CRUDO =
        /\b(?:text|bg|border|ring|fill|stroke)(?:-[ltrbxy])?-(?:red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|slate|gray|zinc|neutral|stone)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/;
    it("no quedan colores crudos de la serie ni de los ejes", () => {
        const hits = src
            .split("\n")
            .map((l, i) => [i + 1, l] as const)
            .filter(([, l]) => CRUDO.test(l))
            .map(([n, l]) => `Sparkline.tsx:${n}: ${l.trim().slice(0, 80)}`);
        expect(hits).toEqual([]);
    });
    it("la serie (línea/área/puntos) va en cielo, los ejes en tinta y el halo del punto en papel", () => {
        expect(src, "serie en cielo").toMatch(/text-cielo/);
        expect(src, "ejes/grilla en tinta").toMatch(/text-tinta\/|fill-tinta\//);
        expect(src, "el halo del punto en la superficie papel").toMatch(/stroke-papel/);
    });
});

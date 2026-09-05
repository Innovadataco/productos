/**
 * SPEC-461 · el estado «Cargando» al Sistema de Diseño (el mueble de más ALCANCE:
 * 110 pantallas). Regla dura del catálogo §6: **skeleton, NUNCA spinner infinito** —
 * un cargando que no termina es peor que un error honesto.
 *
 * Candado de conducta en fuente:
 *  1. El mueble es un SKELETON que pulsa, no un spinner que gira: usa `animate-pulse`
 *     y NO `animate-spin`.
 *  2. Cero color crudo (tokens).
 *  3. Conserva la accesibilidad del estado de carga: `role="status"` + `aria-live`.
 *
 * Contraprueba (por mutación, comprobada al escribir el candado):
 *  · devolver `animate-spin` (el spinner viejo) → rojo del test 1;
 *  · devolver `border-slate-200` (o cualquier crudo) → rojo del test 2.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(__dirname, "Cargando.tsx"), "utf-8");
const sinComentarios = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const CRUDO =
    /#[0-9a-fA-F]{3,8}\b|\b(?:text|bg|border|ring|from|to|via|divide|outline|placeholder|caret|accent|decoration|stroke|fill|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/g;

describe("SPEC-461 · Cargando es skeleton, no spinner infinito", () => {
    it("pulsa (skeleton), no gira (spinner)", () => {
        expect(/animate-pulse/.test(sinComentarios), "El cargando es un skeleton que pulsa.").toBe(true);
        expect(
            /animate-spin/.test(sinComentarios),
            "Nunca spinner infinito (catálogo §6): un cargando que no termina es peor que un error honesto.",
        ).toBe(false);
    });

    it("no trae ningún color crudo — todo por token", () => {
        const crudos = sinComentarios.match(CRUDO) ?? [];
        expect(crudos, `Color crudo en Cargando.tsx (110 pantallas). Encontrado: ${crudos.join(", ")}`).toEqual([]);
    });

    it("conserva la accesibilidad del estado de carga", () => {
        expect(/role="status"/.test(sinComentarios)).toBe(true);
        expect(/aria-live="polite"/.test(sinComentarios)).toBe(true);
    });
});

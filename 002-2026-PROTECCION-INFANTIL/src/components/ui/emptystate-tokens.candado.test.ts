/**
 * SPEC-471 · EmptyState al Sistema de Diseño (catálogo §6): color por token, sin
 * crudo. El copy con verbo / «nunca solo No hay datos» es del call site (title y
 * description son props); el mueble no hornea texto de vacío.
 * Contraprueba (por mutación): un crudo de vuelta → rojo.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(__dirname, "EmptyState.tsx"), "utf-8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const CRUDO =
    /#[0-9a-fA-F]{3,8}\b|\b(?:text|bg|border|ring|from|to|via|divide|outline|placeholder|caret|accent|decoration|stroke|fill|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/g;

describe("SPEC-471 · EmptyState vive en tokens", () => {
    it("no trae ningún color crudo", () => {
        const crudos = src.match(CRUDO) ?? [];
        expect(crudos, `Color crudo en EmptyState.tsx. Encontrado: ${crudos.join(", ")}`).toEqual([]);
    });
});

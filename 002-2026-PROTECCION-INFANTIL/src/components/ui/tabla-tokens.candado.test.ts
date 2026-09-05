/**
 * SPEC-469 · Tabla al Sistema de Diseño (catálogo §2, 51 pantallas). Contrato de
 * forma verificable en fuente: color por TOKEN, y **sin líneas verticales ni zebra**
 * — la separación es por espacio/tono (`divide-y` + wash de tinta), no por rejilla.
 *
 * Contraprueba (por mutación): un crudo de vuelta → rojo del test 1; un `divide-x`
 * o un `odd:`/`even:` (zebra) → rojo del test 2.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(__dirname, "Tabla.tsx"), "utf-8");
const sinComentarios = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const CRUDO =
    /#[0-9a-fA-F]{3,8}\b|\b(?:text|bg|border|ring|from|to|via|divide|outline|placeholder|caret|accent|decoration|stroke|fill|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/g;

describe("SPEC-469 · la Tabla vive en tokens, sin rejilla", () => {
    it("no trae ningún color crudo — todo por token", () => {
        const crudos = sinComentarios.match(CRUDO) ?? [];
        expect(crudos, `Color crudo en Tabla.tsx (51 pantallas). Encontrado: ${crudos.join(", ")}`).toEqual([]);
    });

    it("sin líneas verticales ni zebra — separación por espacio/tono", () => {
        expect(/\bdivide-x\b/.test(sinComentarios), "Sin líneas verticales (no `divide-x`).").toBe(false);
        expect(/\b(?:odd|even):/.test(sinComentarios), "Sin zebra (no `odd:`/`even:`).").toBe(false);
        // La separación horizontal de filas SÍ existe (por espacio/tono).
        expect(/\bdivide-y\b/.test(sinComentarios), "Las filas se separan con `divide-y` (tono), no con rejilla.").toBe(true);
    });
});

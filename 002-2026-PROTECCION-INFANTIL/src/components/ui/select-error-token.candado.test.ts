/**
 * SPEC-470 · el Select al Sistema de Diseño (catálogo §5): el mensaje de error va en
 * token `rubi` (criticidad), nunca en rojo crudo. Mueble de formulario (56 pantallas).
 * Contraprueba (por mutación): devolver `text-red-600` → rojo del test.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(__dirname, "Select.tsx"), "utf-8");
const sinComentarios = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const CRUDO =
    /#[0-9a-fA-F]{3,8}\b|\b(?:text|bg|border|ring|from|to|via|divide|outline|placeholder|caret|accent|decoration|stroke|fill|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/g;

describe("SPEC-470 · el Select vive en tokens", () => {
    it("no trae ningún color crudo — todo por token", () => {
        const crudos = sinComentarios.match(CRUDO) ?? [];
        expect(crudos, `Color crudo en Select.tsx (56 pantallas). Encontrado: ${crudos.join(", ")}`).toEqual([]);
    });
    it("el mensaje de error usa el token `rubi`, no rojo crudo", () => {
        expect(/\btext-rubi\b/.test(sinComentarios), "El error del formulario va en rubi (criticidad).").toBe(true);
    });
});

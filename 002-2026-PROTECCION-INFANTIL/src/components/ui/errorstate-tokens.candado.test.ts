/**
 * SPEC-472 · ErrorState al Sistema de Diseño (catálogo §6): la criticidad va en token
 * `rubi`, nunca rojo crudo; 0 color crudo en el mueble. El copy «qué pasó + cómo salir»
 * ya vive en los defaults del componente.
 * Contraprueba (por mutación): `bg-red-100` de vuelta → rojo.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(__dirname, "ErrorState.tsx"), "utf-8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const CRUDO =
    /#[0-9a-fA-F]{3,8}\b|\b(?:text|bg|border|ring|from|to|via|divide|outline|placeholder|caret|accent|decoration|stroke|fill|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/g;

describe("SPEC-472 · ErrorState vive en tokens", () => {
    it("no trae ningún color crudo", () => {
        const crudos = src.match(CRUDO) ?? [];
        expect(crudos, `Color crudo en ErrorState.tsx. Encontrado: ${crudos.join(", ")}`).toEqual([]);
    });
    it("la criticidad usa `rubi`, no rojo crudo", () => {
        expect(/\b(?:bg|text)-rubi\b/.test(src), "El ícono de error va en rubi (criticidad).").toBe(true);
    });
});

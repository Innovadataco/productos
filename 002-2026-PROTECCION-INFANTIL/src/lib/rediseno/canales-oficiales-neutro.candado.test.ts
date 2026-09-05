/**
 * SPEC-477 (Diseño: NEUTRO uniforme): CanalesOficiales NO pinta cada canal de un
 * color distinto — los canales son de igual peso; se diferencian por número/nombre/
 * ícono, no por color (pintarlos mentiría sobre su jerarquía). Candado de fuente, sin BD.
 * Contraprueba (mutación): reintroducir un `tone` crudo por canal → rojo en ambos tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
    resolve(__dirname, "..", "..", "components/modules/CanalesOficiales.tsx"),
    "utf-8",
).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const CRUDO =
    /\b(?:text|bg|border|ring|from|to|via|divide|outline|placeholder|caret|accent|decoration|stroke|fill|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/g;

describe("SPEC-477 · CanalesOficiales en neutro uniforme", () => {
    it("cero color crudo Tailwind en el archivo", () => {
        const found = src.match(CRUDO) ?? [];
        expect(found, `Color crudo en CanalesOficiales.tsx: ${found.join(", ")}`).toEqual([]);
    });
    it("uniformidad: ningún canal lleva color propio (sin `tone` ni interpolación de color por canal)", () => {
        expect(/\btone\b\s*:/.test(src), "Un `tone` por canal reintroduce color por canal — Diseño ruló neutro uniforme.").toBe(false);
        expect(/\$\{[^}]*\btone\b[^}]*\}/.test(src), "No interpolar un color por canal en la tarjeta/ícono.").toBe(false);
    });
});

/**
 * SPEC-484: los PDFs del colegio (informe del rector + estadísticas) usan el hex de
 * MARCA (el valor CLARO de los tokens), no el emerald crudo — react-pdf no puede leer
 * CSS vars, así que los hex se mantienen en sync con los tokens (comentario en fuente).
 * Candado de fuente, sin BD.
 * Contraprueba (mutación): volver COLOR_PRIMARIO al emerald `#10b981` → rojo.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const informe = readFileSync(resolve(__dirname, "..", "colegio/pdf-informe-mensual.tsx"), "utf-8");
const estad = readFileSync(resolve(__dirname, "..", "colegio/pdf-estadisticas.ts"), "utf-8");

const MARCA: Record<string, string> = {
    COLOR_PRIMARIO: "#0b6e5a", // pino
    COLOR_TEXTO: "#0f1815", // tinta
    COLOR_MUTED: "#4d5552", // tinta-muted
    COLOR_FONDO: "#e9f2ee", // tinte pino muy claro
};

describe("SPEC-484 · PDFs del colegio en hex de marca (pino, no emerald)", () => {
    it("pdf-informe-mensual: constantes en hex de marca (+ BORDE), 0 emerald", () => {
        for (const [k, v] of Object.entries({ ...MARCA, COLOR_BORDE: "#dfe3e1" })) {
            expect(informe.includes(`const ${k} = "${v}"`), `${k} debe ser ${v} (marca), no emerald crudo`).toBe(true);
        }
        expect(/#10b981|#f0fdf4/.test(informe), "no puede quedar emerald crudo en el informe").toBe(false);
    });
    it("pdf-estadisticas: constantes en hex de marca, 0 emerald", () => {
        for (const [k, v] of Object.entries(MARCA)) {
            expect(estad.includes(`const ${k} = "${v}"`), `${k} debe ser ${v} (marca)`).toBe(true);
        }
        expect(/#10b981|#f0fdf4/.test(estad), "no puede quedar emerald crudo en estadisticas").toBe(false);
    });
});

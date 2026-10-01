/**
 * CANDADO · SPEC-808 — el reporte duplicado ni ACUSA ni afirma la conducta vieja.
 *
 * Dos defectos en el mismo lugar (route.ts): (1) el string del 429 culpaba al usuario
 * («Ya reportaste este identificador recientemente»); (2) un comentario afirmaba que el ANÓNIMO
 * «sigue con 429», y es falso (el dedup es autenticado-only: `if (usuarioId)` en reporte-creation,
 * así que al anónimo ese 429 NUNCA le llega).
 *
 * Lee la fuente real y falla si reaparece cualquiera de las dos. Las aserciones apuntan a la FRASE
 * específica de la conducta vieja (no a una co-ocurrencia de «anónimo» + «429», que marcaría también
 * la NEGACIÓN correcta).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url)); // …/src/app/api/reportes
const ROUTE = resolve(AQUI, "route.ts");
const WIZARD = resolve(AQUI, "../../../components/modules/ReporteWizard.tsx");

describe("SPEC-808 · el mensaje de reporte duplicado", () => {
    const src = readFileSync(ROUTE, "utf8");

    it("NO usa el string acusatorio viejo («Ya reportaste este identificador recientemente»)", () => {
        expect(src).not.toContain("Ya reportaste este identificador recientemente");
    });

    it("usa el encuadre de la forma (estado, no acusación): «Ya tienes un reporte sobre esta cuenta»", () => {
        expect(src).toContain("Ya tienes un reporte sobre esta cuenta");
    });

    it("NINGÚN comentario afirma la conducta vieja del anónimo («siguen con 429»)", () => {
        expect(src).not.toMatch(/siguen? con 429/i);
    });

    it("el comentario dice la conducta REAL: el dedup del 429 es autenticado-only", () => {
        expect(src).toMatch(/autenticado-only/i);
    });

    it("no quedó la referencia vencida al «candado 26» atada a este 429", () => {
        // El candado 26 real es del comité (comite-candado26.spec-384.test.ts), no del 429 del anónimo.
        expect(src).not.toContain("candado 26");
    });
});

describe("SPEC-808 · la tarjeta que ve el padre (ReporteWizard)", () => {
    const wiz = readFileSync(WIZARD, "utf8");

    it("NO acusa: ni «Ya reportaste… recientemente» ni «agregar otro evento» / «Cancelar» (el callejón)", () => {
        expect(wiz).not.toContain("Ya reportaste este identificador recientemente");
        expect(wiz).not.toContain("agregar otro evento");
    });

    it("enuncia el estado: «Ya tienes un reporte sobre esta cuenta»", () => {
        expect(wiz).toContain("Ya tienes un reporte sobre esta cuenta");
    });

    it("ofrece las TRES salidas verificadas, no un callejón", () => {
        expect(wiz).toContain("Sumar algo nuevo a este reporte");
        expect(wiz).toContain("Ver mi reporte");
        expect(wiz).toMatch(/>\s*Listo\s*</);
        // «Ver mi reporte» va al detalle propio; «Listo» a la lista (no de vuelta al wizard).
        expect(wiz).toContain("/dashboard/mis-reportes/");
        expect(wiz).toContain('href="/mis-reportes"');
    });
});

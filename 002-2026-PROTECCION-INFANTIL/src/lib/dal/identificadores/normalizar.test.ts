/**
 * SPEC-325 (002-PI-225): normalización única del identificador (mecanismo
 * compartido). Afirma la forma canónica y el fix del defecto silencioso
 * (`TioJuan1` guardado ⟷ `tiojuan1` reportado deben coincidir tras normalizar).
 */
import { describe, it, expect } from "vitest";
import { normalizarIdentificador } from "./normalizar";

describe("normalizarIdentificador", () => {
    it("pasa a minúsculas y recorta espacios", () => {
        expect(normalizarIdentificador("  TioJuan1  ")).toBe("tiojuan1");
    });

    it("el defecto silencioso: guardado y reportado coinciden tras normalizar", () => {
        const guardado = normalizarIdentificador("TioJuan1");
        const reportado = normalizarIdentificador("tiojuan1");
        expect(guardado).toBe(reportado);
    });

    it("es idempotente sobre un valor ya normalizado", () => {
        const una = normalizarIdentificador("Roblox_Kid_2011");
        const dos = normalizarIdentificador(una);
        expect(dos).toBe(una);
        expect(dos).toBe("roblox_kid_2011");
    });

    it("distingue identificadores genuinamente distintos", () => {
        expect(normalizarIdentificador("tiojuan1")).not.toBe(normalizarIdentificador("tiojuan2"));
    });

    it("cadena vacía / solo espacios → vacío", () => {
        expect(normalizarIdentificador("   ")).toBe("");
        expect(normalizarIdentificador("")).toBe("");
    });
});

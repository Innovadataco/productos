/**
 * SPEC-290 (002-PI-190): grep ratchet §4.3 del brief — los parámetros `sesion.*`
 * quedan en la sección "sesiones" del ConfigPanel, no en "other".
 */
import { describe, it, expect } from "vitest";
import { SECTIONS, sectionForParam } from "./types";
import type { Param } from "./types";

function paramFalso(clave: string): Param {
    return {
        id: "id",
        clave,
        valor: "",
        tipo: "INTEGER",
        categoria: "SYSTEM",
        esPublico: false,
        esSecreto: false,
        descripcion: null,
    };
}

describe("SECTIONS · sesiones (SPEC-290)", () => {
    it("existe una sección con key='sesiones' y prefixes=['sesion.']", () => {
        const sec = SECTIONS.find((s) => s.key === "sesiones");
        expect(sec).toBeDefined();
        expect(sec!.prefixes).toEqual(["sesion."]);
    });

    it.each([
        ["sesion.timeout_inactividad_minutos"],
        ["sesion.worker_intervalo_minutos"],
        ["sesion.ping_intervalo_minutos"],
        ["sesion.retencion_dias"],
    ])("sectionForParam('%s') → 'sesiones'", (clave) => {
        expect(sectionForParam(paramFalso(clave)).key).toBe("sesiones");
    });

    it("un parámetro NO sesion.* NO cae en la sección sesiones", () => {
        expect(sectionForParam(paramFalso("scoring.pesos_base")).key).not.toBe("sesiones");
        expect(sectionForParam(paramFalso("system.ollama_base_url")).key).not.toBe("sesiones");
    });
});

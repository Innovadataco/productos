/**
 * SPEC-612 · CANDADO UNITARIO (sin base) — la guarda de credenciales aborta ante variable ausente.
 *
 * Importa SOLO el módulo puro `credenciales-e2e-calidad` (no arrastra Prisma), así corre en la suite
 * unit —cuyo contrato es funcionar SIN base—. Ejercita la AUSENCIA, no la presencia: con una variable
 * faltante `leerCredencialesE2E` aborta, y al ser pura no hay forma de que escriba nada.
 *
 * (El candado de idempotencia toca base y vive en integración: `src/lib/...siembra.candado.test.ts`.)
 */
import { describe, it, expect } from "vitest";
import { leerCredencialesE2E } from "./credenciales-e2e-calidad";

const ENV_COMPLETO: Record<string, string> = {
    E2E_PADRE_EMAIL: "padre.e2e.calidad@example.com",
    E2E_PADRE_PASSWORD: "DummyCalidadUno-2026",
    E2E_PADRE2_EMAIL: "padre2.e2e.calidad@example.com",
    E2E_PADRE2_PASSWORD: "DummyCalidadDos-2026",
    E2E_PROFESIONAL_EMAIL: "profesional.e2e.calidad@example.com",
    E2E_PROFESIONAL_PASSWORD: "DummyCalidadTres-2026",
};

describe("SPEC-612 · lectura de credenciales E2E (pura, sin base)", () => {
    it("entorno completo → devuelve las 3 cuentas con correo y clave", () => {
        const cuentas = leerCredencialesE2E(ENV_COMPLETO);
        expect(cuentas.map((c) => c.clave)).toEqual(["PADRE", "PADRE2", "PROFESIONAL"]);
        expect(cuentas.every((c) => c.email && c.secreto)).toBe(true);
    });

    it("con una variable ausente → ABORTA nombrándola (y al ser pura, no escribe nada)", () => {
        const sinUna = { ...ENV_COMPLETO };
        delete sinUna.E2E_PROFESIONAL_PASSWORD;
        expect(() => leerCredencialesE2E(sinUna)).toThrow(/E2E_PROFESIONAL_PASSWORD/);
    });

    it("entorno vacío → aborta nombrando varias variables faltantes", () => {
        expect(() => leerCredencialesE2E({})).toThrow(/E2E_PADRE_EMAIL/);
    });

    it("una variable en blanco (solo espacios) cuenta como ausente", () => {
        const conBlanco = { ...ENV_COMPLETO, E2E_PADRE_EMAIL: "   " };
        expect(() => leerCredencialesE2E(conBlanco)).toThrow(/E2E_PADRE_EMAIL/);
    });

    it("nunca la cuenta intocable: si una var apunta a soporte@, aborta", () => {
        const conIntocable = { ...ENV_COMPLETO, E2E_PADRE_EMAIL: "soporte@innovadataco.com" };
        expect(() => leerCredencialesE2E(conIntocable)).toThrow(/intocable|soporte@innovadataco\.com/);
    });
});

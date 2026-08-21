import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validarSecretoSimulacion } from "./simulador-secreto";

describe("validarSecretoSimulacion", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it("devuelve false si SIMULADOR_ABUSO_SECRET no está definido", () => {
        delete process.env.SIMULADOR_ABUSO_SECRET;
        const req = new Request("http://localhost/api/reportes", {
            headers: { "x-simulacion-secret": "cualquiera" },
        });
        expect(validarSecretoSimulacion(req)).toBe(false);
    });

    it("devuelve false si el header falta", () => {
        process.env.SIMULADOR_ABUSO_SECRET = "secreto-de-32-bytes-minimo-1234";
        const req = new Request("http://localhost/api/reportes");
        expect(validarSecretoSimulacion(req)).toBe(false);
    });

    it("devuelve false si el header tiene longitud distinta", () => {
        process.env.SIMULADOR_ABUSO_SECRET = "secreto-de-32-bytes-minimo-1234";
        const req = new Request("http://localhost/api/reportes", {
            headers: { "x-simulacion-secret": "corto" },
        });
        expect(validarSecretoSimulacion(req)).toBe(false);
    });

    it("devuelve false si el header es incorrecto (misma longitud)", () => {
        process.env.SIMULADOR_ABUSO_SECRET = "secreto-de-32-bytes-minimo-1234";
        const req = new Request("http://localhost/api/reportes", {
            headers: { "x-simulacion-secret": "secreto-de-32-bytes-minimo-XXXX" },
        });
        expect(validarSecretoSimulacion(req)).toBe(false);
    });

    it("devuelve true si el header coincide exactamente", () => {
        process.env.SIMULADOR_ABUSO_SECRET = "secreto-de-32-bytes-minimo-1234";
        const req = new Request("http://localhost/api/reportes", {
            headers: { "x-simulacion-secret": "secreto-de-32-bytes-minimo-1234" },
        });
        expect(validarSecretoSimulacion(req)).toBe(true);
    });
});
